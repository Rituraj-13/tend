import type {
  AgentSlice,
  Beat,
  ChatMessage,
  DemoPayload,
  Medication,
  Severity,
} from "../shared/types";
import { formatClock, initials, slug, title } from "../shared/format";

export type Power = "off" | "on";
export type TerminalId = "maya" | "rohan" | "host";
export type TerminalTone = "sage" | "salmon" | "ink";
export type RoomState = "locked" | "live";
export type WireState = "open" | "closed";

export interface GapView {
  label: string;
  fact: string;
  id: string;
  state: RoomState;
}

export interface TerminalView {
  id: TerminalId;
  title: string;
  subtitle: string;
  meta: string;
  mono: string;
  signal: string;
  tone: TerminalTone;
  gap: GapView;
}

export interface MemberView {
  id: "maya" | "rohan";
  name: string;
  relation: string;
  agent: string;
  initials: string;
  tone: "sage" | "salmon";
  tag: string;
  state: "LOCAL" | "IN ROOM";
}

export interface HumanEntry {
  kind: "human";
  id: string;
  sender: string;
  body: string;
  meta: string;
}

export interface ProtocolEntry {
  kind: "protocol";
  id: string;
  direction: string;
  label: string;
  detail: string;
  meta: string;
}

export interface ConflictEntry {
  kind: "conflict";
  id: string;
  label: string;
  newMed: string;
  newDose: string;
  newId: string;
  existingMed: string;
  existingDose: string;
  existingId: string;
  severity: Severity;
  reason: string;
  raisedBy: string;
  meta: string;
}

export interface DecisionEntry {
  kind: "decision";
  id: string;
  text: string;
  approvedBy: string;
  decisionId: string;
  meta: string;
}

export type ThreadEntry = HumanEntry | ProtocolEntry | ConflictEntry | DecisionEntry;

export interface SidebarRowView {
  key: "history" | "rules" | "tasks" | "decisions";
  label: string;
  value: string;
  detail: string;
  state: RoomState;
}

export interface RoomView {
  state: RoomState;
  title: string;
  chip: string;
  count: string;
  members: MemberView[];
  thread: ThreadEntry[];
  sidebar: SidebarRowView[];
  empty: { title: string; body: string } | null;
  moreHref: string | null;
}

export interface SwitchView {
  checked: boolean;
  hint: string;
  announcement: string;
}

export interface WireView {
  id: "maya" | "rohan" | "host" | "room";
  label: string;
  state: WireState;
}

export interface WireLoomView {
  state: WireState;
  tag: string;
  items: [WireView, WireView, WireView, WireView];
}

export interface BoardModel {
  power: Power;
  switch: SwitchView;
  terminals: [TerminalView, TerminalView, TerminalView];
  room: RoomView;
  wires: WireLoomView;
}

export interface PowerCopy {
  hint: string;
  announcement: string;
  roomChip: (agents: number) => string;
  roomState: RoomState;
  memberState: "LOCAL" | "IN ROOM";
  signal: "SEALED" | "LINKED";
  hostSignal: "IDLE" | "LIVE";
  wireState: WireState;
  wireTag: string;
  gaps: Record<TerminalId, string>;
}

export const POWER_COPY: Record<Power, PowerCopy> = {
  off: {
    hint: "Private stores are isolated",
    announcement: "Family room off. The room is locked; each agent reads only its own store.",
    roomChip: () => "Room off",
    roomState: "locked",
    memberState: "LOCAL",
    signal: "SEALED",
    hostSignal: "IDLE",
    wireState: "open",
    wireTag: "no contact",
    gaps: { maya: "CANNOT SEE", rohan: "CANNOT SEE", host: "NO ROUTE" },
  },
  on: {
    hint: "The room is connected",
    announcement: "Family room on. A possible interaction reached the room.",
    roomChip: (agents) => `${agents} agents · live`,
    roomState: "live",
    memberState: "IN ROOM",
    signal: "LINKED",
    hostSignal: "LIVE",
    wireState: "closed",
    wireTag: "peer check · redacted reply",
    gaps: { maya: "RECEIVED", rohan: "ANSWERED", host: "ROUTED" },
  },
};

const SIDEBAR_LABELS = [
  { key: "history", label: "History" },
  { key: "rules", label: "Rules" },
  { key: "tasks", label: "Tasks" },
  { key: "decisions", label: "Decisions" },
] as const;

function findSlice(demo: DemoPayload, key: "maya" | "rohan"): AgentSlice {
  const slice = demo.slices.find((item) => item.key === key);
  if (!slice) throw new Error(`Demo payload is missing the ${key} slice.`);
  return slice;
}

function findMedication(slice: AgentSlice, name: string): Medication {
  const medication = slice.medications.find((item) => item.name === name);
  if (!medication) throw new Error(`Demo payload is missing ${name} in ${slice.key}.`);
  return medication;
}

function findMessage(demo: DemoPayload, beat: Beat): ChatMessage {
  const message = demo.transcript.find((item) => item.beat === beat);
  if (!message) throw new Error(`Demo payload is missing the ${beat} message.`);
  return message;
}

function evidenceId(demo: DemoPayload, prefix: "maya" | "rohan", fallback: string): string {
  return demo.conflict.evidenceEventIds.find((id) => id.startsWith(`${prefix}:`)) ?? fallback;
}

function stripPayload(body: string): string {
  return body
    .replace(/```tend[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function terminalMeta(slice: AgentSlice): string {
  return `${slice.relation} · ${slice.records} records · ${slice.withheldNotes} ${
    slice.withheldNotes === 1 ? "note" : "notes"
  } private`;
}

function historyDetail(demo: DemoPayload): string {
  const first = demo.transcript[0]?.at;
  const last = demo.transcript.at(-1)?.at;
  if (!first || !last) return "No messages";
  return `${formatClock(first)}–${formatClock(last)}`;
}

function lockedSidebar(): SidebarRowView[] {
  return SIDEBAR_LABELS.map((row) => ({
    ...row,
    value: "Locked",
    detail: "Room off",
    state: "locked",
  }));
}

function liveSidebar(demo: DemoPayload): SidebarRowView[] {
  return [
    {
      key: "history",
      label: "History",
      value: `${demo.metrics.messages} messages`,
      detail: historyDetail(demo),
      state: "live",
    },
    {
      key: "rules",
      label: "Rules",
      value: `${demo.metrics.owners} owners · ${demo.metrics.agents} agents`,
      detail: "Notes stay private",
      state: "live",
    },
    {
      key: "tasks",
      label: "Tasks",
      value: `${demo.brief.questions.length} review`,
      detail: "Prescriber question",
      state: "live",
    },
    {
      key: "decisions",
      label: "Decisions",
      value: `${demo.brief.decisions.length} · ${demo.decision.approvedBy}`,
      detail: `${demo.decision.id} approved`,
      state: "live",
    },
  ];
}

function buildThread(demo: DemoPayload, maya: AgentSlice, rohan: AgentSlice): ThreadEntry[] {
  const arrival = findMessage(demo, "arrival");
  const peerCheck = findMessage(demo, "peer-check");
  const peerReply = findMessage(demo, "peer-reply");
  const conflictMessage = findMessage(demo, "conflict");
  const decisionMessage = findMessage(demo, "decision");
  const newMed = findMedication(maya, demo.conflict.finding.newMed);
  const existingMed = findMedication(rohan, demo.conflict.finding.existingMed);
  const request = demo.shared.request;
  const reply = demo.shared.reply;

  return [
    {
      kind: "human",
      id: arrival.id,
      sender: arrival.sender,
      body: stripPayload(arrival.body),
      meta: `${formatClock(arrival.at)} · ${arrival.beat}`,
    },
    {
      kind: "protocol",
      id: peerCheck.id,
      direction: `${demo.shared.from} → ${demo.shared.to}`,
      label: `${request.type} · ${request.requestId}`,
      detail: `${title(request.candidate.name)} ${request.candidate.dose} · ${request.candidate.sourceEventId}`,
      meta: `${formatClock(peerCheck.at)} · peer check`,
    },
    {
      kind: "protocol",
      id: peerReply.id,
      direction: `${demo.shared.to} → ${demo.shared.from}`,
      label: `${reply.type} · ${reply.requestId}`,
      detail: `${reply.active.length} shared · ${reply.withheld} withheld`,
      meta: `${formatClock(peerReply.at)} · peer reply`,
    },
    {
      kind: "conflict",
      id: demo.conflict.id,
      label: "Possible interaction",
      newMed: title(newMed.name),
      newDose: newMed.dose,
      newId: newMed.sourceEventId,
      existingMed: title(existingMed.name),
      existingDose: existingMed.dose,
      existingId: existingMed.sourceEventId,
      severity: demo.conflict.finding.severity,
      reason: demo.conflict.finding.reason,
      raisedBy: demo.conflict.raisedBy,
      meta: `${formatClock(conflictMessage.at)} · ${demo.conflict.id}`,
    },
    {
      kind: "decision",
      id: demo.decision.id,
      text: `Decision: ${demo.decision.text}`,
      approvedBy: demo.decision.approvedBy,
      decisionId: demo.decision.id,
      meta: `${formatClock(decisionMessage.at)} · message ${demo.decision.messageId}`,
    },
  ];
}

function buildWires(copy: PowerCopy): WireLoomView {
  const signal = copy.signal.toLowerCase();
  const hostSignal = copy.hostSignal.toLowerCase();
  const roomSignal = copy.roomState === "live" ? "connected" : "sealed";
  return {
    state: copy.wireState,
    tag: copy.wireTag,
    items: [
      { id: "maya", label: `maya · ${signal}`, state: copy.wireState },
      { id: "rohan", label: `rohan · ${signal}`, state: copy.wireState },
      { id: "host", label: `host · ${hostSignal}`, state: copy.wireState },
      { id: "room", label: `room · ${roomSignal}`, state: copy.wireState },
    ],
  };
}

export function buildBoard(demo: DemoPayload, power: Power): BoardModel {
  const copy = POWER_COPY[power];
  const maya = findSlice(demo, "maya");
  const rohan = findSlice(demo, "rohan");
  const newMed = findMedication(maya, demo.conflict.finding.newMed);
  const existingMed = findMedication(rohan, demo.conflict.finding.existingMed);
  const mayaEvidence = evidenceId(demo, "maya", newMed.sourceEventId);
  const rohanEvidence = evidenceId(demo, "rohan", existingMed.sourceEventId);
  const live = copy.roomState === "live";
  const thread = live ? buildThread(demo, maya, rohan) : [];
  const hostFact = live
    ? `${demo.shared.request.requestId} → ${demo.conflict.id}`
    : `${demo.slices.length} stores isolated`;

  const gaps: Record<TerminalId, GapView> = {
    maya: {
      label: copy.gaps.maya,
      fact: `${title(existingMed.name)} ${existingMed.dose}`,
      id: rohanEvidence,
      state: copy.roomState,
    },
    rohan: {
      label: copy.gaps.rohan,
      fact: `${title(newMed.name)} ${newMed.dose}`,
      id: mayaEvidence,
      state: copy.roomState,
    },
    host: {
      label: copy.gaps.host,
      fact: hostFact,
      id: live ? demo.conflict.id : "—",
      state: copy.roomState,
    },
  };

  const terminals: [TerminalView, TerminalView, TerminalView] = [
    {
      id: "maya",
      title: "maya@tend",
      subtitle: maya.agent,
      meta: terminalMeta(maya),
      mono: `var/${maya.key}/events.ndjson`,
      signal: copy.signal,
      tone: "sage",
      gap: gaps.maya,
    },
    {
      id: "rohan",
      title: "rohan@tend",
      subtitle: rohan.agent,
      meta: terminalMeta(rohan),
      mono: `var/${rohan.key}/events.ndjson`,
      signal: copy.signal,
      tone: "salmon",
      gap: gaps.rohan,
    },
    {
      id: "host",
      title: "switch@tend",
      subtitle: "Switch host",
      meta: `Router · ${demo.metrics.owners} owners · ${demo.metrics.agents} agents`,
      mono: `SWITCH_ROOM_ID=${slug(demo.scenario.room)} npm run switch`,
      signal: copy.hostSignal,
      tone: "ink",
      gap: gaps.host,
    },
  ];

  const members: MemberView[] = [maya, rohan].map((slice) => ({
    id: slice.key,
    name: slice.owner,
    relation: slice.relation,
    agent: slice.agent,
    initials: initials(slice.owner),
    tone: slice.color === "sage" ? "sage" : "salmon",
    tag: "AGENT",
    state: copy.memberState,
  }));

  return {
    power,
    switch: {
      checked: live,
      hint: copy.hint,
      announcement: copy.announcement,
    },
    terminals,
    room: {
      state: copy.roomState,
      title: `# ${slug(demo.scenario.room)}`,
      chip: copy.roomChip(demo.metrics.agents),
      count: live ? `${thread.length} of ${demo.metrics.messages}` : `${demo.metrics.messages} held`,
      members,
      thread,
      sidebar: live ? liveSidebar(demo) : lockedSidebar(),
      empty: live
        ? null
        : {
            title: "The room is off.",
            body: "No message crosses. Each agent reads only its own store.",
          },
      moreHref: live ? "#room" : null,
    },
    wires: buildWires(copy),
  };
}
