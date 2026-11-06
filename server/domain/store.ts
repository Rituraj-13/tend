import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CareEvent,
  Conflict,
  Decision,
  EventKind,
  Medication,
  MedicationSummary,
} from "../../src/shared/types";
import { isoDate } from "../../src/shared/format";

interface AppendOptions {
  occurredAt: string;
  sourceRef?: string | null;
}

interface StoreOptions {
  root: string;
  fresh?: boolean;
}

const NOTE_KINDS: EventKind[] = ["appointment", "observation"];

export class Store {
  readonly ownerId: string;
  private readonly dir: string;
  private readonly events: CareEvent[] = [];
  private readonly conflictRows: Conflict[] = [];
  private readonly decisionRows: Decision[] = [];
  private eventSeq = 0;
  private conflictSeq = 0;
  private decisionSeq = 0;

  constructor(ownerId: string, options: StoreOptions) {
    this.ownerId = ownerId;
    this.dir = join(options.root, ownerId);
    if (options.fresh && existsSync(this.dir)) {
      rmSync(this.dir, { recursive: true, force: true });
    }
    mkdirSync(this.dir, { recursive: true });
    this.load("events.ndjson", (line) => {
      const event = JSON.parse(line) as CareEvent;
      this.events.push(event);
      this.eventSeq = Math.max(this.eventSeq, seqOf(event.id));
    });
    this.load("conflicts.ndjson", (line) => {
      const conflict = JSON.parse(line) as Conflict;
      this.conflictRows.push(conflict);
      this.conflictSeq = Math.max(this.conflictSeq, seqOf(conflict.id));
    });
    this.load("decisions.ndjson", (line) => {
      const decision = JSON.parse(line) as Decision;
      this.decisionRows.push(decision);
      this.decisionSeq = Math.max(this.decisionSeq, seqOf(decision.id));
    });
  }

  private load(file: string, read: (line: string) => void): void {
    const path = join(this.dir, file);
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim()) read(line);
    }
  }

  private appendLine(file: string, value: unknown): void {
    appendFileSync(join(this.dir, file), `${JSON.stringify(value)}\n`, "utf8");
  }

  appendEvent(kind: EventKind, payload: Record<string, unknown>, options: AppendOptions): CareEvent {
    this.eventSeq += 1;
    const event: CareEvent = {
      id: `${this.ownerId}:e${String(this.eventSeq).padStart(4, "0")}`,
      ownerId: this.ownerId,
      kind,
      occurredAt: options.occurredAt,
      payload,
      sourceRef: options.sourceRef ?? null,
    };
    this.events.push(event);
    this.appendLine("events.ndjson", event);
    return event;
  }

  eventList(): CareEvent[] {
    return [...this.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  activeMedications(asOf?: string): Medication[] {
    const cutoff = asOf ? isoDate(asOf) : null;
    const active = new Map<string, Medication>();
    for (const event of this.eventList()) {
      const name = String(event.payload.name ?? "").trim().toLowerCase();
      if (!name) continue;
      if (event.kind === "prescription") {
        const started = String(event.payload.startedOn ?? isoDate(event.occurredAt));
        if (cutoff && started > cutoff) continue;
        active.set(name, {
          name,
          dose: String(event.payload.dose ?? "").trim(),
          since: started,
          recordedBy: this.ownerId,
          sourceEventId: event.id,
        });
      } else if (event.kind === "refill") {
        const current = active.get(name);
        active.set(name, {
          name,
          dose: String(event.payload.dose ?? "").trim() || current?.dose || "",
          since: current?.since ?? isoDate(event.occurredAt),
          recordedBy: this.ownerId,
          sourceEventId: current?.sourceEventId ?? event.id,
        });
      } else if (event.kind === "stop") {
        active.delete(name);
      }
    }
    return [...active.values()].sort(
      (a, b) => a.since.localeCompare(b.since) || a.name.localeCompare(b.name),
    );
  }

  summaries(asOf?: string): MedicationSummary[] {
    return this.activeMedications(asOf).map((med) => ({
      name: med.name,
      dose: med.dose,
      since: med.since,
      sourceEventId: med.sourceEventId,
    }));
  }

  noteCount(): number {
    return this.events.filter(
      (event) => NOTE_KINDS.includes(event.kind) && event.payload.kind !== "peer_snapshot",
    ).length;
  }

  saveConflict(conflict: Conflict): void {
    this.conflictSeq += 1;
    this.conflictRows.push(conflict);
    this.appendLine("conflicts.ndjson", conflict);
  }

  updateConflict(conflict: Conflict): void {
    const index = this.conflictRows.findIndex((row) => row.id === conflict.id);
    if (index === -1) throw new Error(`unknown conflict ${conflict.id}`);
    this.conflictRows[index] = conflict;
    this.rewrite("conflicts.ndjson", this.conflictRows);
  }

  conflicts(): Conflict[] {
    return [...this.conflictRows];
  }

  conflictInThread(threadId: string): Conflict | null {
    for (let index = this.conflictRows.length - 1; index >= 0; index -= 1) {
      const conflict = this.conflictRows[index];
      if (conflict && conflict.threadId === threadId) return conflict;
    }
    return null;
  }

  latestOpenConflict(): Conflict | null {
    for (let index = this.conflictRows.length - 1; index >= 0; index -= 1) {
      const conflict = this.conflictRows[index];
      if (conflict && conflict.state === "open") return conflict;
    }
    return null;
  }

  nextConflictId(): string {
    return `c_${String(this.conflictSeq + 1).padStart(4, "0")}`;
  }

  saveDecision(decision: Decision): void {
    this.decisionSeq += 1;
    this.decisionRows.push(decision);
    this.appendLine("decisions.ndjson", decision);
  }

  decisions(): Decision[] {
    return [...this.decisionRows];
  }

  nextDecisionId(): string {
    return `d_${String(this.decisionSeq + 1).padStart(4, "0")}`;
  }

  recordPeerSnapshot(
    agent: string,
    active: MedicationSummary[],
    withheld: number,
    occurredAt: string,
  ): CareEvent {
    return this.appendEvent(
      "observation",
      { kind: "peer_snapshot", agent, active, withheld },
      { occurredAt },
    );
  }

  peerSnapshots(): Array<{ agent: string; active: MedicationSummary[]; withheld: number }> {
    return this.events
      .filter((event) => event.kind === "observation" && event.payload.kind === "peer_snapshot")
      .map((event) => ({
        agent: String(event.payload.agent ?? "another agent"),
        active: Array.isArray(event.payload.active)
          ? (event.payload.active as MedicationSummary[])
          : [],
        withheld: Number(event.payload.withheld ?? 0),
      }));
  }

  private rewrite(file: string, rows: unknown[]): void {
    writeFileSync(
      join(this.dir, file),
      rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""),
      "utf8",
    );
  }
}

function seqOf(id: string): number {
  const match = /(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}
