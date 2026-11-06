export type Severity = "high" | "moderate" | "low";

export type ConflictState = "open" | "resolved" | "dismissed";

export type EventKind =
  | "prescription"
  | "refill"
  | "stop"
  | "appointment"
  | "observation"
  | "decision";

export type Beat =
  | "arrival"
  | "record"
  | "peer-check"
  | "peer-reply"
  | "pharmacy"
  | "conflict"
  | "decision"
  | "brief";

export type Tone =
  | "plain"
  | "agent"
  | "peer-check"
  | "peer-reply"
  | "conflict"
  | "decision"
  | "pharmacy"
  | "handover";

export interface Prescription {
  name: string;
  dose: string;
  startedOn: string;
  raw: string;
}

export interface Medication {
  name: string;
  dose: string;
  since: string;
  recordedBy: string;
  sourceEventId: string;
}

export interface MedicationSummary {
  name: string;
  dose: string;
  since: string;
  sourceEventId: string;
}

export interface Candidate {
  name: string;
  dose: string;
  started: string;
  sourceEventId: string;
}

export interface Finding {
  newMed: string;
  existingMed: string;
  severity: Severity;
  reason: string;
  source: string;
}

export interface CareEvent {
  id: string;
  ownerId: string;
  kind: EventKind;
  occurredAt: string;
  payload: Record<string, unknown>;
  sourceRef?: string | null;
}

export interface Conflict {
  id: string;
  state: ConflictState;
  finding: Finding;
  raisedBy: string;
  evidenceEventIds: string[];
  threadId: string;
  messageId: string;
  raisedAt: string;
  decisionId?: string | null;
}

export interface Decision {
  id: string;
  text: string;
  approvedBy: string;
  messageId: string;
  at: string;
  conflictId?: string | null;
}

export interface PeerRequest {
  v: 1;
  type: "med_check";
  requestId: string;
  candidate: Candidate;
}

export interface PeerReply {
  v: 1;
  type: "med_check_reply";
  requestId: string;
  candidate: Candidate;
  active: MedicationSummary[];
  withheld: number;
}

export type PeerBlock = PeerRequest | PeerReply;

export interface ChatMessage {
  id: string;
  sender: string;
  senderKind: "human" | "agent";
  body: string;
  target?: string | null;
  threadId?: string | null;
  at: string;
  beat: Beat;
  tone: Tone;
}

export interface AgentSlice {
  key: "maya" | "rohan";
  owner: string;
  agent: string;
  relation: string;
  color: "sage" | "clay";
  records: number;
  medications: Medication[];
  withheldNotes: number;
}

export interface SharedEnvelope {
  from: string;
  to: string;
  request: PeerRequest;
  reply: PeerReply;
  note: string;
}

export interface BriefMedication {
  name: string;
  dose: string;
  since: string;
  recordedBy: string;
  shared: boolean;
}

export interface BriefData {
  person: string;
  generatedAt: string;
  medications: BriefMedication[];
  decisions: Decision[];
  conflicts: Conflict[];
  questions: string[];
  audit: {
    ownRecords: number;
    peerRecords: number;
    withheld: number;
    owners: number;
  };
  disclaimer: string;
}

export interface BeatInfo {
  key: Beat;
  label: string;
  note: string;
  at: string;
}

export interface Scenario {
  person: string;
  room: string;
  provider: string;
  source: "offline" | "switch";
  headline: string;
  deck: string;
}

export interface DemoTimeline {
  transcript: ChatMessage[];
  beats: BeatInfo[];
}

export interface Metrics {
  messages: number;
  privateRecords: number;
  sharedFacts: number;
  withheld: number;
  agents: number;
  owners: number;
}

export interface DemoPayload {
  generatedAt: string;
  scenario: Scenario;
  slices: AgentSlice[];
  shared: SharedEnvelope;
  transcript: ChatMessage[];
  beats: BeatInfo[];
  conflict: Conflict;
  decision: Decision;
  brief: BriefData;
  metrics: Metrics;
  pack: { version: number; pairs: number; disclaimer: string };
}

export const severityRank: Record<Severity, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};
