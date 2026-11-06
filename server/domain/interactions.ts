import pack from "../../data/interactions.json";
import type { Finding, Medication, MedicationSummary, Severity } from "../../src/shared/types";

interface RawPair {
  a: string;
  b: string;
  severity: string;
  reason: string;
}

interface RawPack {
  version: number;
  disclaimer: string;
  pairs: RawPair[];
}

const raw = pack as unknown as RawPack;

export interface InteractionPack {
  version: number;
  disclaimer: string;
  pairs: Array<{ a: string; b: string; severity: Severity; reason: string }>;
}

export const interactionPack: InteractionPack = {
  version: raw.version,
  disclaimer: raw.disclaimer,
  pairs: raw.pairs.map((pair) => ({
    a: normalize(pair.a),
    b: normalize(pair.b),
    severity: asSeverity(pair.severity),
    reason: pair.reason,
  })),
};

function asSeverity(value: string): Severity {
  if (value === "high" || value === "moderate" || value === "low") return value;
  return "low";
}

export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findInteractions(
  candidate: string,
  active: Array<Medication | MedicationSummary>,
): Finding[] {
  const name = normalize(candidate);
  const seen = new Set<string>();
  const findings: Finding[] = [];

  for (const medication of active) {
    const existing = normalize(medication.name);
    if (!existing || existing === name || seen.has(existing)) continue;
    const pair = interactionPack.pairs.find(
      (row) => (row.a === name && row.b === existing) || (row.b === name && row.a === existing),
    );
    if (!pair) continue;
    seen.add(existing);
    findings.push({
      newMed: name,
      existingMed: existing,
      severity: pair.severity,
      reason: pair.reason,
      source: "Tend demo rule pack",
    });
  }

  return findings;
}
