import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  LiveAgent,
  LiveAgentFile,
  LiveAgentState,
  LiveCounts,
  LiveIssue,
  LiveMessage,
  LiveSnapshot,
  LiveTotals,
} from "../../src/shared/live";
import {
  LIVE_SCHEMA_VERSION,
  LIVE_STALE_AFTER_MS,
  fingerprint,
  isLiveAgentFile,
} from "../../src/shared/live";

export interface ReadLiveOptions {
  dir: string;
  now?: () => string;
  staleAfterMs?: number;
}

export interface LoadedLiveFile {
  key: string;
  file: LiveAgentFile;
}

const FILE_NAME = /^[a-z0-9_-]+\.json$/;

export function mergeLiveFiles(
  files: LoadedLiveFile[],
  now: string,
  staleAfterMs: number,
  issues: LiveIssue[] = [],
): LiveSnapshot {
  const ordered = [...files].sort(
    (a, b) => a.key.localeCompare(b.key) || a.file.owner.localeCompare(b.file.owner),
  );
  const nowMs = Date.parse(now);
  const agents = ordered.map(({ file }) => toAgent(file, nowMs, staleAfterMs));
  const messages = mergeMessages(ordered);
  const counts = totalCounts(agents, messages);
  const roomId = ordered.find(({ file }) => file.roomId.length > 0)?.file.roomId ?? null;

  return {
    v: LIVE_SCHEMA_VERSION,
    generatedAt: now,
    roomId,
    agents,
    messages,
    counts,
    degraded: issues.length > 0,
    issues: [...issues].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function readLiveSnapshot(options: ReadLiveOptions): LiveSnapshot {
  const now = options.now ?? (() => new Date().toISOString());
  const generatedAt = now();
  const staleAfterMs = options.staleAfterMs ?? LIVE_STALE_AFTER_MS;

  if (!existsSync(options.dir)) return emptySnapshot(generatedAt);

  let names: string[];
  try {
    names = readdirSync(options.dir);
  } catch {
    return emptySnapshot(generatedAt);
  }

  const files: LoadedLiveFile[] = [];
  const issues: LiveIssue[] = [];

  for (const name of names.sort()) {
    if (!FILE_NAME.test(name)) continue;
    const key = name.slice(0, -".json".length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(options.dir, name), "utf8"));
    } catch {
      issues.push({ key, reason: "unreadable" });
      continue;
    }
    if (!isLiveAgentFile(parsed) || parsed.key !== key) {
      issues.push({ key, reason: "invalid" });
      continue;
    }
    files.push({ key, file: parsed });
  }

  return mergeLiveFiles(files, generatedAt, staleAfterMs, issues);
}

function toAgent(file: LiveAgentFile, nowMs: number, staleAfterMs: number): LiveAgent {
  return {
    key: file.key,
    owner: file.owner,
    agent: file.agent,
    person: file.person,
    state: stateFor(file, nowMs, staleAfterMs),
    startedAt: file.startedAt,
    updatedAt: file.updatedAt,
    medications: file.medications.map((medication) => ({
      name: medication.name,
      dose: medication.dose,
      since: medication.since,
      sourceEventId: medication.sourceEventId,
    })),
    counts: cloneCounts(file.counts),
  };
}

function stateFor(file: LiveAgentFile, nowMs: number, staleAfterMs: number): LiveAgentState {
  if (file.status === "closed") return "closed";
  const updated = Date.parse(file.updatedAt);
  if (Number.isNaN(updated) || Number.isNaN(nowMs)) return "stale";
  return nowMs - updated > staleAfterMs ? "stale" : "live";
}

function mergeMessages(files: LoadedLiveFile[]): LiveMessage[] {
  const groups = new Map<string, LiveMessage[]>();

  for (const { file } of files) {
    for (const message of file.messages) {
      const key = message.serverId === null
        ? `u:${message.originKey}:${message.id}`
        : `s:${message.serverId}`;
      const group = groups.get(key);
      if (group) group.push(message);
      else groups.set(key, [message]);
    }
  }

  const known = [...groups.entries()].filter(([key]) => key.startsWith("s:"));
  const unknown = [...groups.entries()]
    .filter(([key]) => key.startsWith("u:"))
    .sort((a, b) => earliestAt(a[1]).localeCompare(earliestAt(b[1])));

  for (const [unknownKey, records] of unknown) {
    const sent = records.find((record) => record.origin === "sent");
    if (!sent) continue;
    const match = known.find(
      ([, candidates]) =>
        candidates.every((candidate) => candidate.origin !== "sent") &&
        fingerprint(candidates[0] ?? sent) === fingerprint(sent),
    );
    if (!match) continue;
    match[1].push(...records);
    groups.delete(unknownKey);
  }

  const merged: LiveMessage[] = [];
  const seen = new Set<string>();
  for (const [key, records] of groups) {
    const canonical = pickCanonical(records);
    const serverId = key.startsWith("s:") ? key.slice(2) : null;
    const target = canonical.target ?? records.find((record) => record.target)?.target ?? null;
    const message: LiveMessage = {
      id: serverId ?? `${canonical.originKey}:${canonical.id}`,
      sender: canonical.sender,
      senderKind: canonical.senderKind,
      body: canonical.body,
      target,
      threadId: canonical.threadId,
      at: canonical.at,
      beat: canonical.beat,
      tone: canonical.tone,
      origin: canonical.origin,
      originKey: canonical.originKey,
      serverId,
      confirmed: serverId !== null,
    };
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    merged.push(message);
  }

  return merged.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

function pickCanonical(records: LiveMessage[]): LiveMessage {
  const authoritative = records.find(
    (record) => record.origin === "sent" && record.tone !== "plain",
  );
  if (authoritative) return authoritative;
  const sent = records.find((record) => record.origin === "sent");
  if (sent) return sent;
  const confirmed = records.find((record) => record.serverId !== null);
  if (confirmed) return confirmed;
  return [...records].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))[0]!;
}

function earliestAt(records: LiveMessage[]): string {
  return records.reduce(
    (earliest, record) => (record.at < earliest ? record.at : earliest),
    records[0]?.at ?? "",
  );
}

function totalCounts(agents: LiveAgent[], messages: LiveMessage[]): LiveTotals {
  const totals: LiveTotals = {
    agents: agents.length,
    messages: messages.length,
    records: 0,
    withheldNotes: 0,
    conflicts: 0,
    decisions: 0,
  };
  for (const agent of agents) {
    totals.records += agent.counts.records;
    totals.withheldNotes += agent.counts.withheldNotes;
    totals.conflicts += agent.counts.conflicts;
    totals.decisions += agent.counts.decisions;
  }
  return totals;
}

function cloneCounts(counts: LiveCounts): LiveCounts {
  return {
    records: counts.records,
    withheldNotes: counts.withheldNotes,
    conflicts: counts.conflicts,
    decisions: counts.decisions,
  };
}

function emptySnapshot(generatedAt: string): LiveSnapshot {
  return {
    v: LIVE_SCHEMA_VERSION,
    generatedAt,
    roomId: null,
    agents: [],
    messages: [],
    counts: {
      agents: 0,
      messages: 0,
      records: 0,
      withheldNotes: 0,
      conflicts: 0,
      decisions: 0,
    },
    degraded: false,
    issues: [],
  };
}
