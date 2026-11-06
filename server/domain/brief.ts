import type {
  BriefData,
  BriefMedication,
  Conflict,
  MedicationSummary,
} from "../../src/shared/types";
import { count, title } from "../../src/shared/format";
import type { Store } from "./store";

export function buildBrief(
  store: Store,
  person: string,
  generatedAt: string,
  disclaimer: string,
  ownerLabel: string,
): BriefData {
  const medications: BriefMedication[] = store.activeMedications().map((med) => ({
    name: med.name,
    dose: med.dose,
    since: med.since,
    recordedBy: ownerLabel,
    shared: false,
  }));

  const seen = new Set(medications.map((med) => `${med.recordedBy}:${med.name}`));
  const snapshots = new Map<string, { active: MedicationSummary[]; withheld: number }>();
  for (const snapshot of store.peerSnapshots()) {
    snapshots.set(snapshot.agent, { active: snapshot.active, withheld: snapshot.withheld });
  }

  let peerRecords = 0;
  let withheld = 0;
  for (const [agent, snapshot] of snapshots) {
    withheld = Math.max(withheld, snapshot.withheld);
    for (const item of snapshot.active) {
      const key = `${agent}:${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      peerRecords += 1;
      medications.push({
        name: item.name,
        dose: item.dose,
        since: item.since,
        recordedBy: agent,
        shared: true,
      });
    }
  }

  const conflicts = store.conflicts();
  const decisions = store.decisions();
  const owners = new Set(medications.map((med) => med.recordedBy));

  return {
    person,
    generatedAt,
    medications: medications.sort(
      (a, b) => a.name.localeCompare(b.name) || a.recordedBy.localeCompare(b.recordedBy),
    ),
    decisions,
    conflicts,
    questions: questionsFor(conflicts),
    audit: {
      ownRecords: store.eventList().filter((event) => event.payload.kind !== "peer_snapshot").length,
      peerRecords,
      withheld,
      owners: owners.size,
    },
    disclaimer,
  };
}

export function briefSummary(brief: BriefData): string {
  return [
    count(brief.medications.length, "medication"),
    count(brief.decisions.length, "decision"),
    `${brief.audit.withheld} notes withheld by another owner`,
  ].join(", ");
}

function questionsFor(conflicts: Conflict[]): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const conflict of [...conflicts].reverse()) {
    const key = `${conflict.finding.newMed}:${conflict.finding.existingMed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(
      `Ask the prescriber whether ${title(conflict.finding.newMed)} and ${title(
        conflict.finding.existingMed,
      )} can be taken together.`,
    );
  }
  return questions.slice(0, 4);
}
