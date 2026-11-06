import WebSocket, { type RawData } from "ws";
import type { ChatMessage, Tone } from "../../src/shared/types";
import type { IncomingMessage, PostOptions, Room } from "../domain/room";
import type { SwitchConfig } from "./config";

type Handler = (message: IncomingMessage) => void;
type ConnectionState = "idle" | "connecting" | "open" | "closed";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 500;

export class SwitchOpError extends Error {
  readonly op: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(op: string, status: number, detail: unknown) {
    super(`Switch operation ${op} failed with status ${status}: ${describeDetail(detail)}`);
    this.name = "SwitchOpError";
    this.op = op;
    this.status = status;
    this.detail = detail;
  }
}

export class SwitchRoom implements Room {
  private readonly config: SwitchConfig;
  private readonly handlers = new Set<Handler>();
  private readonly confirmed = new Set<(localId: string, serverId: string) => void>();
  private readonly cache = new Map<string, ChatMessage>();
  private readonly pending = new Set<Promise<void>>();
  private socket: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private openPromise: Promise<void> | null = null;
  private resolveOpen: (() => void) | null = null;
  private rejectOpen: ((error: Error) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private closedByCaller = false;
  private cursor = 0;
  private sequence = 0;

  constructor(config: SwitchConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    if (this.state === "open") return Promise.resolve();
    if (this.openPromise !== null) return this.openPromise;
    this.closedByCaller = false;
    const promise = new Promise<void>((resolve, reject) => {
      this.resolveOpen = resolve;
      this.rejectOpen = reject;
    });
    this.openPromise = promise;
    this.openSocket();
    return promise;
  }

  async close(): Promise<void> {
    this.closedByCaller = true;
    this.state = "closed";
    if (this.openPromise !== null) {
      this.rejectCurrent(new Error("SwitchRoom closed before connecting"));
    }
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket === null || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      socket.once("close", finish);
      try {
        socket.close();
      } catch {
        finish();
      }
    });
  }

  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onOutboundConfirmed(handler: (localId: string, serverId: string) => void): () => void {
    this.confirmed.add(handler);
    return () => {
      this.confirmed.delete(handler);
    };
  }

  async connectToRoom(roomId: string): Promise<void> {
    await this.callOp<unknown>("connect_to_room", { room_id: roomId });
  }

  post(body: string, options: PostOptions): string {
    const message = this.recordOutbound(body, options, null);
    this.dispatchOp(
      "post_message",
      { body, thread_id: options.threadId ?? null },
      message.id,
    );
    return message.id;
  }

  send(target: string, body: string, options: PostOptions): string {
    const message = this.recordOutbound(body, options, target);
    this.dispatchOp(
      "send_targeted_message",
      { body, target_names: [target], thread_id: options.threadId ?? null },
      message.id,
    );
    return message.id;
  }

  message(id: string): ChatMessage {
    const found = this.cache.get(id);
    if (found === undefined) throw new Error(`unknown message ${id}`);
    return found;
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  private recordOutbound(
    body: string,
    options: PostOptions,
    target: string | null,
  ): ChatMessage {
    this.sequence += 1;
    const tone: Tone = options.tone ?? "agent";
    const message: ChatMessage = {
      id: `local_${this.sequence}`,
      sender: options.sender,
      senderKind: "agent",
      body,
      target,
      threadId: options.threadId ?? null,
      at: new Date().toISOString(),
      beat: "record",
      tone,
    };
    this.cache.set(message.id, message);
    return message;
  }

  private dispatchOp(
    op: string,
    args: Record<string, unknown>,
    localId: string,
  ): void {
    let task: Promise<void>;
    task = this.callOp<unknown>(op, args)
      .then((result) => {
        this.aliasOutbound(localId, result);
      })
      .catch((error: unknown) => {
        this.log(`${op} failed: ${describeError(error)}`);
      })
      .finally(() => {
        this.pending.delete(task);
      });
    this.pending.add(task);
  }

  private aliasOutbound(localId: string, result: unknown): void {
    if (!isRecord(result)) return;
    const rawEventId = result.event_id;
    if (typeof rawEventId !== "string" && typeof rawEventId !== "number") return;
    const eventId = String(rawEventId);
    const message = this.cache.get(localId);
    if (message === undefined) return;
    this.cache.set(eventId, { ...message, id: eventId });
    for (const handler of this.confirmed) handler(localId, eventId);
  }

  private async callOp<T>(op: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(
      `${this.config.baseUrl}/agents/${encodeURIComponent(this.config.agentId)}/ops/${encodeURIComponent(op)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "X-Switch-Connection-Id": this.config.connectionId,
        },
        body: JSON.stringify(args),
      },
    );

    const text = await response.text();
    const parsed = text.length > 0 ? parseJson(text) : null;

    if (!response.ok) {
      const detail =
        isRecord(parsed) && "detail" in parsed
          ? parsed.detail
          : parsed ?? response.statusText;
      throw new SwitchOpError(op, response.status, detail);
    }

    if (!isRecord(parsed) || !("result" in parsed)) {
      throw new SwitchOpError(op, response.status, "response missing result envelope");
    }

    return parsed.result as T;
  }

  private openSocket(): void {
    if (this.closedByCaller) return;
    this.state = "connecting";
    const socket = new WebSocket(this.connectionUrl(), {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    this.socket = socket;
    socket.on("open", () => this.handleOpen(socket));
    socket.on("message", (raw) => this.handleRaw(raw));
    socket.on("error", (error) => this.handleSocketError(error));
    socket.on("close", (code, reason) => this.handleClose(socket, code, reason));
  }

  private connectionUrl(): string {
    const params = new URLSearchParams({
      connection_id: this.config.connectionId,
      scope: "single",
      filter: "all",
      spawn_capable: "false",
    });
    if (this.cursor > 0) params.set("start_from", String(this.cursor));
    return `${this.config.wsUrl}/agents/${encodeURIComponent(this.config.agentId)}/connection/ws?${params.toString()}`;
  }

  private handleOpen(socket: WebSocket): void {
    if (this.socket !== socket) {
      socket.close();
      return;
    }
    this.state = "open";
    this.attempt = 0;
    this.openPromise = null;
    const resolve = this.resolveOpen;
    this.resolveOpen = null;
    this.rejectOpen = null;
    resolve?.();
  }

  private handleSocketError(error: Error): void {
    this.log(`websocket error: ${error.message}`);
    if (this.state === "connecting") {
      this.rejectCurrent(new Error(`WebSocket connection failed: ${error.message}`));
    }
  }

  private rejectCurrent(error: Error): void {
    this.openPromise = null;
    this.resolveOpen = null;
    const reject = this.rejectOpen;
    this.rejectOpen = null;
    reject?.(error);
  }

  private handleClose(socket: WebSocket, code: number, reason: Buffer): void {
    if (this.socket !== null && this.socket !== socket) return;
    if (this.socket === socket) this.socket = null;
    const wasConnecting = this.state === "connecting";
    if (this.state !== "closed") this.state = "idle";
    if (wasConnecting) {
      this.rejectCurrent(
        new Error(`WebSocket closed before opening (${code} ${reason.toString()})`),
      );
    }
    if (this.closedByCaller) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.closedByCaller) return;
    const delay = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * 2 ** Math.min(this.attempt, 6),
    );
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByCaller) this.openSocket();
    }, delay);
  }

  private handleRaw(raw: RawData): void {
    try {
      this.handleFrame(rawToText(raw));
    } catch (error) {
      this.log(`ignoring frame: ${describeError(error)}`);
    }
  }

  private handleFrame(text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.log("ignoring malformed frame: not JSON");
      return;
    }

    if (!isRecord(parsed) || typeof parsed.event !== "string") {
      this.log("ignoring malformed frame: missing event");
      return;
    }

    const event = parsed.event;
    const data = isRecord(parsed.data) ? parsed.data : {};
    const sequence = numberValue(parsed.id) ?? numberValue(data.sequence);
    if (sequence !== null) this.cursor = sequence;

    if (event === "ping") {
      // The server pings on the heartbeat interval and expects a pong with the
      // client's cursor (Switch agent protocol, revision 9).
      const cursor = numberValue(data.cursor) ?? this.cursor;
      this.sendRaw({ type: "pong", cursor });
      return;
    }

    if (event === "connection_state") {
      const cursor = numberValue(data.cursor);
      if (cursor !== null) this.cursor = cursor;
      return;
    }

    if (event === "refused") {
      const status = numberValue(data.status) ?? 0;
      this.rejectCurrent(
        new Error(
          `Switch refused the connection (${status}): ${describeDetail(data.detail)}`,
        ),
      );
      return;
    }

    if (event === "evicted") {
      this.log(`connection evicted: ${describeDetail(data.reason)}`);
      return;
    }

    if (event === "gap") {
      this.log(
        `event gap from ${describeDetail(data.from_sequence)}: ${describeDetail(
          data.reason,
        )}. Read room context before acting.`,
      );
      return;
    }

    if (event === "message") {
      this.dispatchMessage(data);
    }
  }

  private dispatchMessage(data: Record<string, unknown>): void {
    const payload = isRecord(data.payload) ? data.payload : data;
    const messageId = stringValue(payload.message_id);
    const body = stringValue(payload.body);
    if (messageId === null || body === null) {
      this.log("ignoring malformed message frame");
      return;
    }

    const senderName =
      stringValue(payload.sender_name) ?? stringValue(payload.sender) ?? "unknown";
    const senderKind = payload.sender_kind === "agent" ? "agent" : "human";
    const timestamp = numberValue(payload.timestamp);
    const threadId = stringValue(payload.thread_id);
    const addressed = payload.addressed === true;
    const at =
      timestamp === null
        ? new Date().toISOString()
        : new Date(timestamp).toISOString();

    const message: IncomingMessage = {
      id: messageId,
      sender: senderName,
      senderKind,
      body,
      threadId,
      at,
      addressed,
    };

    this.cache.set(messageId, {
      id: messageId,
      sender: senderName,
      senderKind,
      body,
      target: null,
      threadId,
      at,
      beat: "record",
      tone: "plain",
    });

    for (const handler of this.handlers) handler(message);
  }

  private sendRaw(payload: unknown): void {
    const socket = this.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  private log(line: string): void {
    console.error(`[switch] ${line}`);
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return describeDetail(error);
}

function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail === null || detail === undefined) return "no detail";
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function rawToText(raw: RawData): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  return raw.toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
