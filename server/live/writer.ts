import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatMessage, MedicationSummary } from "../../src/shared/types";
import type {
  LiveAgentFile,
  LiveCounts,
  LiveFileStatus,
  LiveMessage,
} from "../../src/shared/live";
import {
  LIVE_HEARTBEAT_MS,
  LIVE_SCHEMA_VERSION,
  beatForTone,
  fingerprint,
  isLiveAgentFile,
} from "../../src/shared/live";
import type { IncomingMessage } from "../domain/room";
import type { Store } from "../domain/store";

export type StoreReader = Pick<
  Store,
  "summaries" | "noteCount" | "eventList" | "conflicts" | "decisions"
>;

export interface LiveWriterOptions {
  dir: string;
  key: string;
  owner: string;
  agent: string;
  person: string;
  roomId: string;
  store: StoreReader;
  clock: () => string;
  heartbeatMs?: number;
  debounceMs?: number;
}

export class LiveWriter {
  private readonly options: LiveWriterOptions;
  private messages: LiveMessage[] = [];
  private status: LiveFileStatus = "live";
  private readonly startedAt: string;
  private debounceTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private started = false;
  private stopped = false;
  private lastError: string | null = null;

  constructor(options: LiveWriterOptions) {
    this.options = options;
    this.startedAt = options.clock();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      mkdirSync(this.directory(), { recursive: true, mode: 0o700 });
      this.hydrate();
    } catch (error) {
      this.logFailure(error);
    }
    this.flush();
    this.heartbeatTimer = setInterval(
      () => this.flush(),
      this.options.heartbeatMs ?? LIVE_HEARTBEAT_MS,
    );
    this.heartbeatTimer.unref();
  }

  observeOutbound(message: ChatMessage): void {
    if (this.stopped) return;
    this.messages.push(
      this.normalize(message, "sent", this.options.key, null, message.target ?? null),
    );
    this.schedule();
  }

  observeInbound(message: IncomingMessage): void {
    if (this.stopped) return;
    if (this.messages.some((item) => item.serverId === message.id)) return;

    if (message.sender === this.options.agent) {
      const key = fingerprint(message);
      const pending = this.messages.find(
        (item) =>
          item.origin === "sent" && item.serverId === null && fingerprint(item) === key,
      );
      if (pending) {
        pending.serverId = message.id;
        pending.confirmed = true;
        this.schedule();
        return;
      }
    }

    const received = this.normalize(
      {
        id: message.id,
        sender: message.sender,
        senderKind: message.senderKind,
        body: message.body,
        target: null,
        threadId: message.threadId,
        at: message.at,
        beat: "record",
        tone: "plain",
      },
      "received",
      this.options.key,
      message.id,
      null,
    );
    this.messages.push(received);
    this.schedule();
  }

  confirm(localId: string, serverId: string): void {
    if (this.stopped) return;
    const sent = this.messages.find((item) => item.origin === "sent" && item.id === localId);
    if (!sent || sent.serverId !== null) return;
    sent.serverId = serverId;
    sent.confirmed = true;
    this.messages = this.messages.filter(
      (item) => item.origin === "sent" || item.serverId !== serverId,
    );
    this.schedule();
  }

  snapshot(): LiveAgentFile {
    return {
      v: LIVE_SCHEMA_VERSION,
      key: this.options.key,
      owner: this.options.owner,
      agent: this.options.agent,
      person: this.options.person,
      roomId: this.options.roomId,
      status: this.status,
      startedAt: this.startedAt,
      updatedAt: this.options.clock(),
      messages: [...this.messages].sort(compareMessages).map(cloneMessage),
      medications: this.medications(),
      counts: this.counts(),
    };
  }

  flush(): void {
    const target = join(this.directory(), `${this.options.key}.json`);
    const temp = join(this.directory(), `.${this.options.key}.json.${process.pid}.tmp`);
    try {
      mkdirSync(this.directory(), { recursive: true, mode: 0o700 });
      writeFileSync(temp, `${JSON.stringify(this.snapshot(), null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      renameSync(temp, target);
    } catch (error) {
      try {
        rmSync(temp, { force: true });
      } catch {}
      this.logFailure(error);
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.status = "closed";
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.flush();
  }

  private directory(): string {
    return this.options.dir;
  }

  private schedule(): void {
    if (this.stopped || this.debounceTimer !== null) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flush();
    }, this.options.debounceMs ?? 50);
    this.debounceTimer.unref();
  }

  private normalize(
    message: ChatMessage,
    origin: LiveMessage["origin"],
    originKey: string,
    serverId: string | null,
    target: string | null,
  ): LiveMessage {
    return {
      id: message.id,
      sender: message.sender,
      senderKind: message.senderKind,
      body: message.body,
      target,
      threadId: message.threadId ?? null,
      at: message.at,
      beat: beatForTone(message.tone),
      tone: message.tone,
      origin,
      originKey,
      serverId,
      confirmed: serverId !== null,
    };
  }

  private medications(): MedicationSummary[] {
    return this.options.store.summaries().map((medication) => ({
      name: medication.name,
      dose: medication.dose,
      since: medication.since,
      sourceEventId: medication.sourceEventId,
    }));
  }

  private counts(): LiveCounts {
    return {
      records: this.options.store
        .eventList()
        .filter((event) => event.payload.kind !== "peer_snapshot").length,
      withheldNotes: this.options.store.noteCount(),
      conflicts: this.options.store.conflicts().length,
      decisions: this.options.store.decisions().length,
    };
  }

  private hydrate(): void {
    const path = join(this.directory(), `${this.options.key}.json`);
    if (!existsSync(path)) return;
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isLiveAgentFile(parsed)) return;
    if (parsed.roomId !== this.options.roomId) return;
    const seen = new Set<string>();
    const kept: LiveMessage[] = [];
    for (const message of parsed.messages) {
      if (message.serverId === null || seen.has(message.serverId)) continue;
      seen.add(message.serverId);
      kept.push(cloneMessage(message));
    }
    this.messages = kept;
  }

  private logFailure(error: unknown): void {
    const line = error instanceof Error ? error.message : String(error);
    if (line === this.lastError) return;
    this.lastError = line;
    console.error(`[live] write failed: ${line}`);
  }
}

function compareMessages(a: LiveMessage, b: LiveMessage): number {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
}

function cloneMessage(message: LiveMessage): LiveMessage {
  return {
    id: message.id,
    sender: message.sender,
    senderKind: message.senderKind,
    body: message.body,
    target: message.target,
    threadId: message.threadId,
    at: message.at,
    beat: message.beat,
    tone: message.tone,
    origin: message.origin,
    originKey: message.originKey,
    serverId: message.serverId,
    confirmed: message.confirmed,
  };
}
