import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { seedMaya, seedRohan } from "../server/domain/demo";
import { Store } from "../server/domain/store";
import { LiveWriter } from "../server/live/writer";
import type { ChatMessage } from "../src/shared/types";
import { isLiveAgentFile } from "../src/shared/live";

const roots: string[] = [];
const NOW = "2026-11-03T09:12:00.000Z";
const PRIVATE_NOTES = [
  "Mum said the new tablets make her sleepy.",
  "INR check, Dr Rao's clinic. Result 2.4, in range.",
  "Annual review with Dr Rao.",
  "Bruise on left forearm after a small fall.",
  "Reports feeling tired in the afternoons.",
];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function workspace(): { root: string; live: string } {
  const root = mkdtempSync(join(tmpdir(), "tend-live-"));
  roots.push(root);
  return { root, live: join(root, "live") };
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "local_1",
    sender: "Maya's agent",
    senderKind: "agent",
    body: "Rohan's agent, can you check the records you hold?",
    target: "Rohan's agent",
    threadId: "t_e0003",
    at: NOW,
    beat: "record",
    tone: "peer-check",
    ...overrides,
  };
}

function writerFor(
  store: Store,
  dir: string,
  overrides: Partial<{ key: string; owner: string; agent: string; roomId: string }> = {},
): LiveWriter {
  return new LiveWriter({
    dir,
    key: overrides.key ?? "maya",
    owner: overrides.owner ?? "Maya",
    agent: overrides.agent ?? "Maya's agent",
    person: "Kamala",
    roomId: overrides.roomId ?? "room_rao",
    store,
    clock: () => NOW,
  });
}

describe("the live writer", () => {
  it("projects before start so tests and callers can inspect it", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const snapshot = writerFor(store, live).snapshot();

    expect(snapshot.status).toBe("live");
    expect(snapshot.key).toBe("maya");
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.startedAt).toBe(NOW);
  });

  it("writes one atomic file with the tone beat and no temp leftovers", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const writer = writerFor(store, live);

    writer.start();
    writer.observeOutbound(message());
    writer.flush();

    const names = readdirSync(live);
    expect(names).toEqual(["maya.json"]);
    const parsed: unknown = JSON.parse(readFileSync(join(live, "maya.json"), "utf8"));
    expect(isLiveAgentFile(parsed)).toBe(true);
    if (!isLiveAgentFile(parsed)) return;
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]?.beat).toBe("peer-check");
    expect(parsed.messages[0]?.confirmed).toBe(false);
    expect(parsed.messages[0]?.target).toBe("Rohan's agent");
    writer.stop();
  });

  it("merges our own socket echo instead of duplicating it", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const writer = writerFor(store, live);
    writer.start();
    writer.observeOutbound(message());

    writer.observeInbound({
      id: "evt_40",
      sender: "Maya's agent",
      senderKind: "agent",
      body: message().body,
      threadId: "t_e0003",
      at: "2026-11-03T09:12:01.000Z",
      addressed: false,
    });

    expect(writer.snapshot().messages).toHaveLength(1);
    expect(writer.snapshot().messages[0]?.serverId).toBe("evt_40");
    expect(writer.snapshot().messages[0]?.confirmed).toBe(true);
    writer.stop();
  });

  it("keeps a peer message and drops a duplicate confirmed record on confirm", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const writer = writerFor(store, live);
    writer.start();
    writer.observeOutbound(message({ body: "different body" }));

    writer.observeInbound({
      id: "evt_41",
      sender: "Maya's agent",
      senderKind: "agent",
      body: "unmatched echo body",
      threadId: "t_e0003",
      at: "2026-11-03T09:12:02.000Z",
      addressed: false,
    });
    expect(writer.snapshot().messages).toHaveLength(2);

    writer.confirm("local_1", "evt_41");
    const messages = writer.snapshot().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.serverId).toBe("evt_41");
    writer.stop();
  });

  it("hydrates confirmed history and forgets unconfirmed sends on restart", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const first = writerFor(store, live);
    first.start();
    first.observeOutbound(message({ id: "local_1" }));
    first.confirm("local_1", "evt_50");
    first.observeOutbound(message({ id: "local_2", body: "never confirmed" }));
    first.stop();

    const second = writerFor(store, live);
    second.start();
    const messages = second.snapshot().messages;

    expect(messages).toHaveLength(1);
    expect(messages[0]?.serverId).toBe("evt_50");
    second.stop();
  });

  it("closes the file on stop and tolerates a second stop", () => {
    const { root, live } = workspace();
    const store = new Store("maya", { root });
    const writer = writerFor(store, live);
    writer.start();
    writer.stop();
    writer.stop();

    const parsed: unknown = JSON.parse(readFileSync(join(live, "maya.json"), "utf8"));
    expect(isLiveAgentFile(parsed)).toBe(true);
    if (!isLiveAgentFile(parsed)) return;
    expect(parsed.status).toBe("closed");
  });

  it("never serializes a private note or appointment", () => {
    const { root, live } = workspace();
    const maya = new Store("maya", { root });
    const rohan = new Store("rohan", { root });
    seedMaya(maya);
    seedRohan(rohan);

    const mayaWriter = writerFor(maya, live);
    const rohanWriter = writerFor(rohan, live, {
      key: "rohan",
      owner: "Rohan",
      agent: "Rohan's agent",
    });
    mayaWriter.start();
    rohanWriter.start();
    rohanWriter.observeInbound({
      id: "evt_60",
      sender: "Maya's agent",
      senderKind: "agent",
      body: "Rohan's agent, can you check the records you hold?",
      threadId: "t_e0003",
      at: NOW,
      addressed: true,
    });
    mayaWriter.stop();
    rohanWriter.stop();

    const mayaWire = readFileSync(join(live, "maya.json"), "utf8");
    const rohanWire = readFileSync(join(live, "rohan.json"), "utf8");
    for (const note of PRIVATE_NOTES) {
      expect(mayaWire).not.toContain(note);
      expect(rohanWire).not.toContain(note);
    }

    const rohanFile: unknown = JSON.parse(rohanWire);
    expect(isLiveAgentFile(rohanFile)).toBe(true);
    if (!isLiveAgentFile(rohanFile)) return;
    expect(rohanFile.counts.withheldNotes).toBe(4);
    for (const medication of rohanFile.medications) {
      expect(Object.keys(medication).sort()).toEqual(["dose", "name", "since", "sourceEventId"]);
    }
  });
});
