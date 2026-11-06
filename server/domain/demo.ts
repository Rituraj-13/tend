import { join } from "node:path";
import type {
  AgentSlice,
  Beat,
  BeatInfo,
  ChatMessage,
  DemoPayload,
  PeerReply,
  PeerRequest,
  SharedEnvelope,
} from "../../src/shared/types";
import { count } from "../../src/shared/format";
import { buildBrief } from "./brief";
import { decodeBlock } from "./brain";
import { FakeRoom } from "./fake-room";
import { interactionPack } from "./interactions";
import { CareAgent } from "./policy";
import { Store } from "./store";

const START = Date.parse("2026-11-03T09:12:00.000Z");
const OWNER = "Maya";
const PEER = "Rohan";
const AGENT = "Maya's agent";
const PEER_AGENT = "Rohan's agent";
const PERSON = "Kamala";

const BEAT_COPY: Record<Beat, { label: string; note: string }> = {
  arrival: { label: "Maya posts", note: "A new prescription, typed in the family room." },
  record: { label: "Her agent records it", note: "It asks for the dose and says what it cannot see." },
  "peer-check": { label: "Agent to agent", note: "Maya's agent asks Rohan's agent by name." },
  "peer-reply": { label: "The missing record", note: "Warfarin. Five milligrams. Since February 2024." },
  conflict: { label: "The conflict surfaces", note: "Neither agent could see it alone." },
  pharmacy: { label: "A human checks", note: "Rohan's pharmacist flags the same pair." },
  decision: { label: "The decision holds", note: "A name, a time, and a message id." },
  brief: { label: "The brief is written", note: "Ready for the next appointment." },
};

export interface DemoOptions {
  root: string;
}

export function runDemo({ root }: DemoOptions): DemoPayload {
  let minute = 0;
  const clock = () => new Date(START + minute * 60_000).toISOString();
  const tick = (minutes = 2) => {
    minute += minutes;
  };

  const mayaStore = new Store("maya", { root: join(root, "var"), fresh: true });
  const rohanStore = new Store("rohan", { root: join(root, "var"), fresh: true });

  seedMaya(mayaStore);
  seedRohan(rohanStore);

  const room = new FakeRoom("Rao family", clock);
  room.registerAgent(AGENT);
  room.registerAgent(PEER_AGENT);

  const maya = new CareAgent({
    owner: OWNER,
    agentName: AGENT,
    peerOwner: PEER,
    peerAgent: PEER_AGENT,
    person: PERSON,
    store: mayaStore,
    room,
    clock,
  });

  const rohan = new CareAgent({
    owner: PEER,
    agentName: PEER_AGENT,
    peerOwner: OWNER,
    peerAgent: AGENT,
    person: PERSON,
    store: rohanStore,
    room,
    clock,
  });

  const arrival = room.humanPost(
    OWNER,
    "Mum started trimethoprim 100 mg today. Dr Rao prescribed it.",
  );
  maya.handle(arrival);

  const peerCheck = findTone(room.messages, "peer-check");
  if (!peerCheck) throw new Error("peer check was not posted");
  rohan.handle(room.incoming(peerCheck.id));

  const peerReply = findTone(room.messages, "peer-reply");
  if (!peerReply) throw new Error("peer reply was not posted");
  tick();
  maya.handle(room.incoming(peerReply.id));

  tick();
  room.humanPost(
    PEER,
    "The pharmacist flagged it too. Same interaction. She said hold the new med until Dr Rao confirms.",
    null,
    "pharmacy",
  );

  tick();
  const decisionPost = room.humanPost(
    OWNER,
    "Decision: hold the new med until Dr Rao confirms.",
    null,
    "decision",
  );
  maya.handle(decisionPost);

  tick();
  const transcript: ChatMessage[] = room.messages.map((message) => ({
    ...message,
    beat: beatFor(message),
  }));

  const conflict = mayaStore.conflicts()[0];
  const decision = mayaStore.decisions()[0];
  if (!conflict) throw new Error("no conflict was raised");
  if (!decision) throw new Error("no decision was recorded");

  const request = decodeBlock(peerCheck.body);
  const reply = decodeBlock(peerReply.body);
  if (request?.type !== "med_check") throw new Error("peer check was not a med_check");
  if (reply?.type !== "med_check_reply") throw new Error("peer reply was not a med_check_reply");

  const generatedAt = clock();
  const brief = buildBrief(mayaStore, PERSON, generatedAt, interactionPack.disclaimer, OWNER);

  return {
    generatedAt,
    scenario: {
      person: PERSON,
      room: "Rao family",
      provider: "Switch",
      source: "offline",
      headline: "Two people. Two agents. One room.",
      deck:
        "No one held the whole medication list. One agent knew the new prescription. The other knew the blood thinner. The room is where the two records finally met.",
    },
    slices: [
      sliceFor("maya", OWNER, AGENT, "Daughter", "sage", mayaStore, generatedAt),
      sliceFor("rohan", PEER, PEER_AGENT, "Son", "clay", rohanStore, generatedAt),
    ],
    shared: envelope(request, reply),
    transcript,
    beats: buildBeats(transcript),
    conflict,
    decision,
    brief,
    metrics: {
      messages: transcript.length,
      privateRecords:
        mayaStore.eventList().filter((event) => event.payload.kind !== "peer_snapshot").length +
        rohanStore.eventList().filter((event) => event.payload.kind !== "peer_snapshot").length,
      sharedFacts: reply.active.length,
      withheld: reply.withheld,
      agents: 2,
      owners: 2,
    },
    pack: {
      version: interactionPack.version,
      pairs: interactionPack.pairs.length,
      disclaimer: interactionPack.disclaimer,
    },
  };
}

export function seedMaya(store: Store): void {
  store.appendEvent(
    "refill",
    { name: "paracetamol", dose: "500 mg" },
    { occurredAt: "2026-10-14T10:05:00.000Z", sourceRef: "m_seed_maya_refill" },
  );
  store.appendEvent(
    "observation",
    { kind: "note", text: "Mum said the new tablets make her sleepy.", by: OWNER },
    { occurredAt: "2026-10-20T18:40:00.000Z", sourceRef: "m_seed_maya_note" },
  );
}

export function seedRohan(store: Store): void {
  store.appendEvent(
    "prescription",
    { name: "warfarin", dose: "5 mg", startedOn: "2024-02-11" },
    { occurredAt: "2024-02-11T09:00:00.000Z", sourceRef: "m_seed_rohan_warfarin" },
  );
  store.appendEvent(
    "prescription",
    { name: "atorvastatin", dose: "20 mg", startedOn: "2025-01-08" },
    { occurredAt: "2025-01-08T11:30:00.000Z", sourceRef: "m_seed_rohan_statin" },
  );
  store.appendEvent(
    "appointment",
    { kind: "appointment", text: "INR check, Dr Rao's clinic. Result 2.4, in range." },
    { occurredAt: "2026-10-02T08:15:00.000Z", sourceRef: "m_seed_rohan_inr" },
  );
  store.appendEvent(
    "appointment",
    { kind: "appointment", text: "Annual review with Dr Rao." },
    { occurredAt: "2026-08-14T15:00:00.000Z", sourceRef: "m_seed_rohan_review" },
  );
  store.appendEvent(
    "observation",
    { kind: "note", text: "Bruise on left forearm after a small fall.", by: PEER },
    { occurredAt: "2026-09-28T19:10:00.000Z", sourceRef: "m_seed_rohan_bruise" },
  );
  store.appendEvent(
    "observation",
    { kind: "note", text: "Reports feeling tired in the afternoons.", by: PEER },
    { occurredAt: "2026-07-03T16:45:00.000Z", sourceRef: "m_seed_rohan_tired" },
  );
}

function findTone(messages: ChatMessage[], tone: ChatMessage["tone"]): ChatMessage | undefined {
  return messages.find((message) => message.tone === tone);
}

function beatFor(message: ChatMessage): Beat {
  switch (message.tone) {
    case "peer-check":
      return "peer-check";
    case "peer-reply":
      return "peer-reply";
    case "conflict":
      return "conflict";
    case "decision":
      return "decision";
    case "handover":
      return "brief";
    case "pharmacy":
      return "pharmacy";
    case "plain":
      return "arrival";
    default:
      return "record";
  }
}

function buildBeats(messages: ChatMessage[]): BeatInfo[] {
  const order: Beat[] = [
    "arrival",
    "record",
    "peer-check",
    "peer-reply",
    "conflict",
    "pharmacy",
    "decision",
    "brief",
  ];
  return order
    .map((key) => {
      const first = messages.find((message) => message.beat === key);
      if (!first) return null;
      return { key, ...BEAT_COPY[key], at: first.at };
    })
    .filter((beat): beat is BeatInfo => beat !== null);
}

function sliceFor(
  key: AgentSlice["key"],
  owner: string,
  agent: string,
  relation: string,
  color: AgentSlice["color"],
  store: Store,
  at: string,
): AgentSlice {
  return {
    key,
    owner,
    agent,
    relation,
    color,
    records: store.eventList().filter((event) => event.payload.kind !== "peer_snapshot").length,
    medications: store.activeMedications(at),
    withheldNotes: store.noteCount(),
  };
}

function envelope(request: PeerRequest, reply: PeerReply): SharedEnvelope {
  return {
    from: AGENT,
    to: PEER_AGENT,
    request,
    reply,
    note: `${count(reply.active.length, "medication")} shared. ${count(
      reply.withheld,
      "note",
    )} withheld.`,
  };
}


