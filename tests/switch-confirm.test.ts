import { afterEach, describe, expect, it } from "vitest";
import { SwitchRoom } from "../server/switch/client";

const CONFIG = {
  baseUrl: "http://switch.test",
  wsUrl: "ws://switch.test",
  apiKey: "key",
  agentId: "agent_1",
  roomId: "room_1",
  registrationToken: "token",
  connectionId: "conn_1",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("the outbound confirmation", () => {
  it("reports the local id and the server event id", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ result: { event_id: "evt_99" } }), { status: 200 });

    const room = new SwitchRoom(CONFIG);
    const seen: Array<[string, string]> = [];
    room.onOutboundConfirmed((localId, serverId) => seen.push([localId, serverId]));

    const localId = room.post("hello", { sender: "Maya's agent", tone: "agent" });
    await room.flush();

    expect(localId).toBe("local_1");
    expect(seen).toEqual([["local_1", "evt_99"]]);
  });

  it("stays quiet when the operation fails", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ detail: "nope" }), { status: 500 });

    const room = new SwitchRoom(CONFIG);
    const seen: Array<[string, string]> = [];
    room.onOutboundConfirmed((localId, serverId) => seen.push([localId, serverId]));

    room.post("hello", { sender: "Maya's agent", tone: "agent" });
    await room.flush();

    expect(seen).toEqual([]);
  });
});
