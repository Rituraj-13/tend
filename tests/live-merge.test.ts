import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { LiveAgentFile, LiveMessage } from "../src/shared/live";
import { LIVE_SCHEMA_VERSION } from "../src/shared/live";
import { mergeLiveFiles, readLiveSnapshot } from "../server/live/merge";

const roots: string[] = [];
const NOW = "2026-11-03T09:12:10.000Z";

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function message(overrides: Partial<LiveMessage> = {}): LiveMessage {
  return {
    id: "evt_40",
    sender: "Maya",
    senderKind: "human",
    body: "Mum started trimethoprim 100 mg today.",
    target: null,
    threadId: null,
    at: "2026-11-03T09:12:00.000Z",
    beat: "arrival",
    tone: "plain",
    origin: "received",
    originKey: "maya",
    serverId: "evt_40",
    confirmed: true,
    ...overrides,
  };
}

function file(overrides: Partial<LiveAgentFile> = {}): LiveAgentFile {
  return {
    v: LIVE_SCHEMA_VERSION,
    key: "maya",
    owner: "Maya",
    agent: "Maya's agent",
    person: "Kamala",
    roomId: "room_rao",
    status: "live",
    startedAt: "2026-11-03T09:00:00.000Z",
    updatedAt: "2026-11-03T09:12:08.000Z",
    messages: [],
    medications: [],
    counts: { records: 2, withheldNotes: 1, conflicts: 0, decisions: 0 },
    ...overrides,
  };
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "tend-merge-"));
  roots.push(root);
  return root;
}

describe("the live merge", () => {
  it("returns an empty snapshot for a missing directory", () => {
    const snapshot = readLiveSnapshot({ dir: join(fixture(), "absent"), now: () => NOW });
    expect(snapshot.roomId).toBeNull();
    expect(snapshot.agents).toEqual([]);
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.degraded).toBe(false);
    expect(snapshot.counts).toEqual({
      agents: 0,
      messages: 0,
      records: 0,
      withheldNotes: 0,
      conflicts: 0,
      decisions: 0,
    });
  });

  it("collapses the same human message seen by both agents", () => {
    const snapshot = mergeLiveFiles(
      [
        { key: "maya", file: file({ messages: [message()] }) },
        { key: "rohan", file: file({ key: "rohan", owner: "Rohan", messages: [message()] }) },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.tone).toBe("plain");
    expect(snapshot.messages[0]?.origin).toBe("received");
    expect(snapshot.counts.messages).toBe(1);
  });

  it("prefers the author's tone and target over the peer's plain echo", () => {
    const sent = message({
      id: "evt_41",
      sender: "Maya's agent",
      senderKind: "agent",
      body: "Rohan's agent, can you check the records you hold?",
      target: "Rohan's agent",
      threadId: "t_e0003",
      tone: "peer-check",
      origin: "sent",
      serverId: "evt_41",
      beat: "peer-check",
    });
    const echo = message({
      ...sent,
      tone: "plain",
      target: null,
      origin: "received",
      originKey: "rohan",
      beat: "arrival",
    });

    const snapshot = mergeLiveFiles(
      [
        { key: "maya", file: file({ messages: [sent] }) },
        { key: "rohan", file: file({ key: "rohan", owner: "Rohan", messages: [echo] }) },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.tone).toBe("peer-check");
    expect(snapshot.messages[0]?.target).toBe("Rohan's agent");
    expect(snapshot.messages[0]?.beat).toBe("peer-check");
    expect(snapshot.messages[0]?.id).toBe("evt_41");
  });

  it("pairs an unconfirmed send with the peer's server copy", () => {
    const pending = message({
      id: "local_1",
      sender: "Maya's agent",
      senderKind: "agent",
      body: "Rohan's agent, can you check the records you hold?",
      target: "Rohan's agent",
      threadId: "t_e0003",
      tone: "peer-check",
      origin: "sent",
      originKey: "maya",
      serverId: null,
      confirmed: false,
      at: "2026-11-03T09:12:00.000Z",
      beat: "peer-check",
    });
    const received = message({
      ...pending,
      id: "evt_42",
      tone: "plain",
      target: null,
      origin: "received",
      originKey: "rohan",
      serverId: "evt_42",
      confirmed: true,
      at: "2026-11-03T09:12:01.000Z",
      beat: "arrival",
    });

    const snapshot = mergeLiveFiles(
      [
        { key: "maya", file: file({ messages: [pending] }) },
        { key: "rohan", file: file({ key: "rohan", owner: "Rohan", messages: [received] }) },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]?.id).toBe("evt_42");
    expect(snapshot.messages[0]?.serverId).toBe("evt_42");
    expect(snapshot.messages[0]?.confirmed).toBe(true);
    expect(snapshot.messages[0]?.tone).toBe("peer-check");
    expect(snapshot.messages[0]?.originKey).toBe("maya");
  });

  it("pairs repeated identical bodies one-to-one", () => {
    const pending = (id: string, at: string): LiveMessage =>
      message({
        id,
        sender: "Maya's agent",
        senderKind: "agent",
        body: "same body",
        target: "Rohan's agent",
        threadId: "t_1",
        tone: "peer-check",
        origin: "sent",
        serverId: null,
        confirmed: false,
        at,
        beat: "peer-check",
      });
    const received = (id: string, at: string): LiveMessage =>
      message({
        id,
        sender: "Maya's agent",
        senderKind: "agent",
        body: "same body",
        target: null,
        threadId: "t_1",
        tone: "plain",
        origin: "received",
        originKey: "rohan",
        serverId: id,
        confirmed: true,
        at,
        beat: "arrival",
      });

    const snapshot = mergeLiveFiles(
      [
        {
          key: "maya",
          file: file({
            messages: [
              pending("local_1", "2026-11-03T09:12:00.000Z"),
              pending("local_2", "2026-11-03T09:12:02.000Z"),
            ],
          }),
        },
        {
          key: "rohan",
          file: file({
            key: "rohan",
            owner: "Rohan",
            messages: [
              received("evt_50", "2026-11-03T09:12:01.000Z"),
              received("evt_51", "2026-11-03T09:12:03.000Z"),
            ],
          }),
        },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages.map((item) => item.id).sort()).toEqual(["evt_50", "evt_51"]);
    expect(snapshot.messages.every((item) => item.confirmed)).toBe(true);
  });

  it("orders messages by time and then id", () => {
    const snapshot = mergeLiveFiles(
      [
        {
          key: "maya",
          file: file({
            messages: [
              message({ id: "evt_b", serverId: "evt_b", at: "2026-11-03T09:12:02.000Z" }),
              message({ id: "evt_a", serverId: "evt_a", at: "2026-11-03T09:12:02.000Z" }),
              message({ id: "evt_0", serverId: "evt_0", at: "2026-11-03T09:12:01.000Z" }),
            ],
          }),
        },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.messages.map((item) => item.id)).toEqual(["evt_0", "evt_a", "evt_b"]);
  });

  it("marks a quiet agent stale and a stopped agent closed", () => {
    const snapshot = mergeLiveFiles(
      [
        { key: "maya", file: file({ updatedAt: "2026-11-03T09:11:50.000Z" }) },
        { key: "rohan", file: file({ key: "rohan", owner: "Rohan", status: "closed" }) },
        {
          key: "third",
          file: file({ key: "third", owner: "Third", updatedAt: "2026-11-03T09:12:09.000Z" }),
        },
      ],
      NOW,
      15_000,
    );

    expect(snapshot.agents.map((agent) => [agent.key, agent.state])).toEqual([
      ["maya", "stale"],
      ["rohan", "closed"],
      ["third", "live"],
    ]);
  });

  it("keeps the valid files when one file is broken", () => {
    const dir = fixture();
    writeFileSync(join(dir, "maya.json"), "{ not json", "utf8");
    writeFileSync(join(dir, "rohan.json"), JSON.stringify(file({ key: "wrong" })), "utf8");
    writeFileSync(
      join(dir, "third.json"),
      JSON.stringify(file({ key: "third", owner: "Third", messages: [message()] })),
      "utf8",
    );

    const snapshot = readLiveSnapshot({ dir, now: () => NOW });

    expect(snapshot.degraded).toBe(true);
    expect(snapshot.issues).toEqual([
      { key: "maya", reason: "unreadable" },
      { key: "rohan", reason: "invalid" },
    ]);
    expect(snapshot.agents.map((agent) => agent.key)).toEqual(["third"]);
    expect(snapshot.messages).toHaveLength(1);
  });

  it("strips extra fields from a tampered medication row", () => {
    const dir = fixture();
    const tampered = file({
      medications: [
        {
          name: "warfarin",
          dose: "5 mg",
          since: "2024-02-11",
          sourceEventId: "rohan:e0001",
          noteText: "Bruise on left forearm after a small fall.",
        },
      ] as unknown as LiveAgentFile["medications"],
    });
    writeFileSync(join(dir, "maya.json"), JSON.stringify(tampered), "utf8");

    const snapshot = readLiveSnapshot({ dir, now: () => NOW });
    const medication = snapshot.agents[0]?.medications[0];

    expect(medication).toEqual({
      name: "warfarin",
      dose: "5 mg",
      since: "2024-02-11",
      sourceEventId: "rohan:e0001",
    });
    expect(JSON.stringify(snapshot)).not.toContain("Bruise");
  });
});
