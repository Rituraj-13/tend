import type { Candidate, PeerBlock, Prescription } from "../../src/shared/types";
import { isoDate } from "../../src/shared/format";

const DOSE = String.raw`\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|units?)`;
const NAME_WITH_DOSE = new RegExp(
  String.raw`\b([A-Za-z][A-Za-z0-9-]{2,})\s+(${DOSE})\b`,
  "i",
);
const START_CUE = new RegExp(
  String.raw`\b(started|starting|start|prescribed|new|began|beginning|switched|stopped|stopping)\b`,
  "i",
);
const NAME_AFTER_CUE = new RegExp(
  String.raw`\b(?:started|starting|prescribed|began|switched to)\s+([A-Za-z][A-Za-z0-9-]{2,})\b`,
  "i",
);
const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const TEND_BLOCK = /```tend\s*(\{[\s\S]*?\})\s*```/;

const START_VERBS = new Set(["started", "starting", "prescribed", "began", "beginning", "new"]);

export function encodeBlock(payload: PeerBlock): string {
  return "```tend\n" + JSON.stringify(payload, null, 2) + "\n```";
}

export function decodeBlock(text: string): PeerBlock | null {
  const match = TEND_BLOCK.exec(text);
  if (!match?.[1]) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }
  return parsePeerBlock(parsed);
}

export function parsePeerBlock(value: unknown): PeerBlock | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  const candidate = parseCandidate(raw.candidate);
  if (!candidate) return null;
  const requestId = typeof raw.requestId === "string" ? raw.requestId : "";
  if (!requestId) return null;

  if (raw.type === "med_check") {
    return { v: 1, type: "med_check", requestId, candidate };
  }
  if (raw.type === "med_check_reply") {
    const active = Array.isArray(raw.active) ? raw.active.map(parseSummary).filter(isPresent) : [];
    const withheld = Number(raw.withheld ?? 0);
    return {
      v: 1,
      type: "med_check_reply",
      requestId,
      candidate,
      active,
      withheld: Number.isFinite(withheld) ? withheld : 0,
    };
  }
  return null;
}

function parseCandidate(value: unknown): Candidate | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim().toLowerCase() : "";
  if (!name) return null;
  return {
    name,
    dose: typeof raw.dose === "string" ? raw.dose.trim() : "",
    started: typeof raw.started === "string" ? raw.started : "",
    sourceEventId: typeof raw.sourceEventId === "string" ? raw.sourceEventId : "",
  };
}

function parseSummary(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim().toLowerCase() : "";
  const since = typeof raw.since === "string" ? raw.since : "";
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(since)) return null;
  return {
    name,
    dose: typeof raw.dose === "string" ? raw.dose.trim() : "",
    since,
    sourceEventId: typeof raw.sourceEventId === "string" ? raw.sourceEventId : "",
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export function extractPrescription(text: string, today: string): Prescription | null {
  if (decodeBlock(text)) return null;
  const cue = START_CUE.exec(text);
  if (!cue) return null;
  const verb = (cue[1] ?? "").toLowerCase();
  if (!START_VERBS.has(verb)) return null;

  const withDose = NAME_WITH_DOSE.exec(text);
  const afterCue = NAME_AFTER_CUE.exec(text);
  const name = withDose?.[1] ?? afterCue?.[1];
  if (!name) return null;

  return {
    name: name.trim().toLowerCase(),
    dose: (withDose?.[2] ?? "").split(/\s+/).filter(Boolean).join(" "),
    startedOn: startedOn(text, today),
    raw: text.trim(),
  };
}

function startedOn(text: string, today: string): string {
  const explicit = ISO_DATE.exec(text);
  if (explicit?.[1]) return explicit[1];
  if (/\byesterday\b/i.test(text)) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 1);
    return isoDate(date);
  }
  return today;
}
