import type { Candidate, Conflict, Decision, PeerBlock, Prescription } from "../../src/shared/types";
import { formatDay, formatMoment, isoDate, count, title } from "../../src/shared/format";
import { buildBrief, briefSummary } from "./brief";
import { decodeBlock, encodeBlock, extractPrescription } from "./brain";
import { findInteractions, interactionPack, normalize } from "./interactions";
import { resolveConflict } from "./models";
import type { IncomingMessage, Room } from "./room";
import type { Store } from "./store";

export interface AgentConfig {
  owner: string;
  agentName: string;
  peerOwner: string;
  peerAgent: string;
  person: string;
  store: Store;
  room: Room;
  clock: () => string;
}

export class CareAgent {
  private readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  handle(message: IncomingMessage): string[] {
    if (!message.addressed || message.sender === this.config.agentName) return [];

    const block = decodeBlock(message.body);
    if (message.senderKind === "agent") {
      return block ? this.onPeerBlock(message, block) : [];
    }
    if (block) return [];

    const lowered = message.body.toLowerCase();
    if (lowered.includes("decision:")) return this.onDecision(message);
    if (lowered.includes("brief") || lowered.includes("handover")) return this.onBrief(message);
    const prescription = extractPrescription(message.body, isoDate(message.at));
    if (prescription) return this.onPrescription(message, prescription);
    return this.onNote(message);
  }

  private onPrescription(message: IncomingMessage, prescription: Prescription): string[] {
    const { store, room, agentName, owner, peerAgent, peerOwner, person } = this.config;
    const event = store.appendEvent(
      "prescription",
      {
        name: prescription.name,
        dose: prescription.dose,
        startedOn: prescription.startedOn,
      },
      { occurredAt: message.at, sourceRef: message.id },
    );

    const threadId = message.threadId ?? message.id;
    const label = medLabel(prescription.name, prescription.dose);
    const first = room.post(
      [
        `Recorded **${label}** for ${person}, started ${formatDay(prescription.startedOn)}.`,
        "",
        `${owner}, is ${prescription.dose || "that dose"} right? I read your records only, so I cannot see what ${peerOwner} holds. I will ask their agent to check this against their list.`,
      ].join("\n"),
      { sender: agentName, threadId, tone: "agent" },
    );

    const candidate: Candidate = {
      name: prescription.name,
      dose: prescription.dose,
      started: prescription.startedOn,
      sourceEventId: event.id,
    };
    const requestId = `q_${event.id.split(":").at(-1) ?? "01"}`;
    const peer = room.send(
      peerAgent,
      [
        `${peerOwner}'s agent, can you check the records you hold against this new prescription?`,
        "",
        encodeBlock({ v: 1, type: "med_check", requestId, candidate }),
      ].join("\n"),
      { sender: agentName, threadId, tone: "peer-check" },
    );

    return [first, peer];
  }

  private onPeerBlock(message: IncomingMessage, block: PeerBlock): string[] {
    if (block.type === "med_check") return this.onMedCheck(message, block.candidate, block.requestId);
    return this.onMedCheckReply(message, block);
  }

  private onMedCheck(
    message: IncomingMessage,
    candidate: Candidate,
    requestId: string,
  ): string[] {
    const { store, room, agentName, owner } = this.config;
    const active = store.summaries();
    const withheld = store.noteCount();
    const threadId = message.threadId ?? message.id;

    const reply = room.send(
      message.sender,
      [
        `Checked my records for **${title(candidate.name)}**.`,
        "",
        `I hold ${count(active.length, "active medication")} and ${count(withheld, "note")}.`,
        "",
        "I can share names, doses and dates. I will not share notes.",
        "",
        encodeBlock({
          v: 1,
          type: "med_check_reply",
          requestId,
          candidate,
          active,
          withheld,
        }),
      ].join("\n"),
      { sender: agentName, threadId, tone: "peer-reply" },
    );

    if (!active.length) return [reply];

    const ask = room.send(
      owner,
      `${owner}, please check this with the pharmacy. I cannot approve a new medicine for you.`,
      { sender: agentName, threadId, tone: "agent" },
    );
    return [reply, ask];
  }

  private onMedCheckReply(
    message: IncomingMessage,
    block: Extract<PeerBlock, { type: "med_check_reply" }>,
  ): string[] {
    const { store, room, agentName, owner, peerOwner } = this.config;
    store.recordPeerSnapshot(message.sender, block.active, block.withheld, message.at);

    const findings = findInteractions(block.candidate.name, block.active);
    const threadId = message.threadId ?? message.id;

    if (!findings.length) {
      return [
        room.post(
          [
            `No interaction in the demo rule pack between **${title(block.candidate.name)}** and the ${count(
              block.active.length,
              "medication",
            )} ${peerOwner}'s agent can see.`,
            "",
            "That is not a clean bill of health. It means this rule pack found nothing.",
          ].join("\n"),
          { sender: agentName, threadId, tone: "agent" },
        ),
      ];
    }

    const finding = findings.reduce((best, item) =>
      severityRank(item.severity) > severityRank(best.severity) ? item : best,
    );
    const existing = block.active.find(
      (item) => normalize(item.name) === finding.existingMed,
    );
    const evidence = [block.candidate.sourceEventId, existing?.sourceEventId].filter(
      (id): id is string => Boolean(id),
    );

    const body = [
      "Possible interaction",
      "",
      `**${medLabel(finding.newMed, block.candidate.dose)}** · started ${formatDay(
        block.candidate.started,
      )} · ${owner}'s record`,
      `**${medLabel(finding.existingMed, existing?.dose ?? "")}** · since ${
        existing ? formatDay(existing.since) : "unknown"
      } · ${peerOwner}'s record`,
      "",
      finding.reason,
      "",
      "**What I need**",
      `${owner}, confirm with the prescriber before the next dose. ${peerOwner}, ask the pharmacy to check it too.`,
      "",
      "Source: Tend demo rule pack. Not medical advice.",
    ].join("\n");

    const messageId = room.post(body, { sender: agentName, threadId, tone: "conflict" });
    const conflict: Conflict = {
      id: store.nextConflictId(),
      state: "open",
      finding,
      raisedBy: agentName,
      evidenceEventIds: evidence,
      threadId,
      messageId,
      raisedAt: message.at,
      decisionId: null,
    };
    store.saveConflict(conflict);
    return [messageId];
  }

  private onDecision(message: IncomingMessage): string[] {
    const { store, room, agentName, person, owner } = this.config;
    const threadId = message.threadId ?? message.id;
    const conflict = store.conflictInThread(threadId) ?? store.latestOpenConflict();
    if (!conflict) return [];

    if (conflict.state !== "open") {
      return [
        room.post(
          `Conflict ${conflict.id} is already ${conflict.state}. I have not changed it.`,
          { sender: agentName, threadId, tone: "agent" },
        ),
      ];
    }

    const decision: Decision = {
      id: store.nextDecisionId(),
      text: decisionText(message.body),
      approvedBy: message.sender,
      messageId: message.id,
      at: message.at,
      conflictId: conflict.id,
    };
    store.saveDecision(decision);
    store.updateConflict(resolveConflict(conflict, decision.id));

    const posted = room.post(
      [
        "Decision recorded",
        "",
        title(decision.text),
        "",
        `**${decision.approvedBy}** · ${formatMoment(decision.at)} · message ${decision.messageId} · conflict ${conflict.id}`,
      ].join("\n"),
      { sender: agentName, threadId, tone: "decision" },
    );

    const brief = buildBrief(
      store,
      person,
      this.config.clock(),
      interactionPack.disclaimer,
      owner,
    );
    const handover = room.post(
      [
        `Brief ready for ${person}.`,
        "",
        `${briefSummary(brief)}.`,
        "",
        `${owner}, the appointment copy is in the care brief on the Tend page, or ask me for a handover any time.`,
      ].join("\n"),
      { sender: agentName, threadId, tone: "handover" },
    );

    return [posted, handover];
  }

  private onBrief(message: IncomingMessage): string[] {
    const { store, room, agentName, person, owner } = this.config;
    const brief = buildBrief(
      store,
      person,
      this.config.clock(),
      interactionPack.disclaimer,
      owner,
    );
    return [
      room.post(
        `Brief ready for ${person}. ${briefSummary(brief)}.`,
        { sender: agentName, threadId: message.threadId ?? message.id, tone: "handover" },
      ),
    ];
  }

  private onNote(message: IncomingMessage): string[] {
    const { store, room, agentName, owner } = this.config;
    store.appendEvent(
      "observation",
      { kind: "note", text: message.body, by: message.sender },
      { occurredAt: message.at, sourceRef: message.id },
    );
    return [
      room.post(`Noted. I added that to ${owner}'s record.`, {
        sender: agentName,
        threadId: message.threadId ?? message.id,
        tone: "agent",
      }),
    ];
  }
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "moderate") return 2;
  return 1;
}

function medLabel(name: string, dose: string): string {
  const clean = title(name);
  return dose ? `${clean} ${dose}` : clean;
}

function decisionText(body: string): string {
  const lowered = body.toLowerCase();
  const index = lowered.indexOf("decision:");
  const text = index >= 0 ? body.slice(index + "decision:".length) : body;
  return text.trim().replace(/\s+/g, " ");
}
