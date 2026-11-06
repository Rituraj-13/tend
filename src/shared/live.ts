import type { Beat, ChatMessage, MedicationSummary, Tone } from "./types";

export const LIVE_SCHEMA_VERSION = 1 as const;
export const LIVE_STALE_AFTER_MS = 15_000;
export const LIVE_POLL_INTERVAL_MS = 2_000;
export const LIVE_HEARTBEAT_MS = 5_000;

export type LiveAgentState = "live" | "stale" | "closed";
export type LiveMessageOrigin = "sent" | "received";
export type LiveFileStatus = "live" | "closed";

export interface LiveMessage extends ChatMessage {
  target: string | null;
  threadId: string | null;
  origin: LiveMessageOrigin;
  originKey: string;
  serverId: string | null;
  confirmed: boolean;
}

export interface LiveCounts {
  records: number;
  withheldNotes: number;
  conflicts: number;
  decisions: number;
}

export interface LiveTotals extends LiveCounts {
  agents: number;
  messages: number;
}

export interface LiveAgentFile {
  v: typeof LIVE_SCHEMA_VERSION;
  key: string;
  owner: string;
  agent: string;
  person: string;
  roomId: string;
  status: LiveFileStatus;
  startedAt: string;
  updatedAt: string;
  messages: LiveMessage[];
  medications: MedicationSummary[];
  counts: LiveCounts;
}

export interface LiveAgent {
  key: string;
  owner: string;
  agent: string;
  person: string;
  state: LiveAgentState;
  startedAt: string;
  updatedAt: string;
  medications: MedicationSummary[];
  counts: LiveCounts;
}

export interface LiveIssue {
  key: string;
  reason: "unreadable" | "invalid";
}

export interface LiveSnapshot {
  v: typeof LIVE_SCHEMA_VERSION;
  generatedAt: string;
  roomId: string | null;
  agents: LiveAgent[];
  messages: LiveMessage[];
  counts: LiveTotals;
  degraded: boolean;
  issues: LiveIssue[];
}

const TONE_BEAT: Record<Tone, Beat> = {
  plain: "arrival",
  agent: "record",
  "peer-check": "peer-check",
  "peer-reply": "peer-reply",
  conflict: "conflict",
  decision: "decision",
  pharmacy: "pharmacy",
  handover: "brief",
};

export function beatForTone(tone: Tone): Beat {
  return TONE_BEAT[tone];
}

export function fingerprint(
  message: Pick<LiveMessage, "sender" | "threadId" | "body">,
): string {
  return `${message.sender}\u0000${message.threadId ?? ""}\u0000${message.body}`;
}

export function isLiveTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function isLiveAgentFile(value: unknown): value is LiveAgentFile {
  if (!isRecord(value)) return false;
  if (value.v !== LIVE_SCHEMA_VERSION) return false;
  if (!isText(value.key) || !isText(value.owner) || !isText(value.agent)) return false;
  if (!isText(value.person) || !isText(value.roomId)) return false;
  if (value.status !== "live" && value.status !== "closed") return false;
  if (!isLiveTimestamp(value.startedAt) || !isLiveTimestamp(value.updatedAt)) return false;
  if (!Array.isArray(value.messages) || !value.messages.every(isLiveMessage)) return false;
  if (!Array.isArray(value.medications) || !value.medications.every(isMedicationSummary)) {
    return false;
  }
  return isCounts(value.counts);
}

export function isLiveSnapshot(value: unknown): value is LiveSnapshot {
  if (!isRecord(value)) return false;
  if (value.v !== LIVE_SCHEMA_VERSION) return false;
  if (!isLiveTimestamp(value.generatedAt)) return false;
  if (value.roomId !== null && !isText(value.roomId)) return false;
  if (!Array.isArray(value.agents) || !value.agents.every(isLiveAgent)) return false;
  if (!Array.isArray(value.messages) || !value.messages.every(isLiveMessage)) return false;
  if (!isTotals(value.counts)) return false;
  if (typeof value.degraded !== "boolean") return false;
  return Array.isArray(value.issues) && value.issues.every(isIssue);
}

function isLiveAgent(value: unknown): value is LiveAgent {
  if (!isRecord(value)) return false;
  if (!isText(value.key) || !isText(value.owner) || !isText(value.agent)) return false;
  if (!isText(value.person)) return false;
  if (value.state !== "live" && value.state !== "stale" && value.state !== "closed") return false;
  if (!isLiveTimestamp(value.startedAt) || !isLiveTimestamp(value.updatedAt)) return false;
  if (!Array.isArray(value.medications) || !value.medications.every(isMedicationSummary)) {
    return false;
  }
  return isCounts(value.counts);
}

function isLiveMessage(value: unknown): value is LiveMessage {
  if (!isRecord(value)) return false;
  if (!isText(value.id) || !isText(value.sender) || !isText(value.body)) return false;
  if (value.senderKind !== "human" && value.senderKind !== "agent") return false;
  if (value.target !== null && !isText(value.target)) return false;
  if (value.threadId !== null && !isText(value.threadId)) return false;
  if (!isLiveTimestamp(value.at)) return false;
  if (!isText(value.beat) || !isText(value.tone)) return false;
  if (value.origin !== "sent" && value.origin !== "received") return false;
  if (!isText(value.originKey)) return false;
  if (value.serverId !== null && !isText(value.serverId)) return false;
  return typeof value.confirmed === "boolean";
}

function isMedicationSummary(value: unknown): value is MedicationSummary {
  if (!isRecord(value)) return false;
  return (
    isText(value.name) &&
    isText(value.dose) &&
    isText(value.since) &&
    isText(value.sourceEventId)
  );
}

function isCounts(value: unknown): value is LiveCounts {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.records) &&
    isNumber(value.withheldNotes) &&
    isNumber(value.conflicts) &&
    isNumber(value.decisions)
  );
}

function isTotals(value: unknown): value is LiveTotals {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.records) &&
    isNumber(value.withheldNotes) &&
    isNumber(value.conflicts) &&
    isNumber(value.decisions) &&
    isNumber(value.agents) &&
    isNumber(value.messages)
  );
}

function isIssue(value: unknown): value is LiveIssue {
  if (!isRecord(value)) return false;
  return isText(value.key) && (value.reason === "unreadable" || value.reason === "invalid");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
