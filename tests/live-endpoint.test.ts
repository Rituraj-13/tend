import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfigFromFile, type ConfigEnv } from "vite";
import { LIVE_SCHEMA_VERSION } from "../src/shared/live";
import { liveEndpointResponse } from "../server/live/vite-plugin";

const roots: string[] = [];
const NOW = "2026-11-03T09:12:10.000Z";

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "tend-endpoint-"));
  roots.push(root);
  return root;
}

function writeEmptyRoom(dir: string): void {
  writeFileSync(
    join(dir, "maya.json"),
    JSON.stringify({
      v: LIVE_SCHEMA_VERSION,
      key: "maya",
      owner: "Maya",
      agent: "Maya's agent",
      person: "Kamala",
      roomId: "room_rao",
      status: "live",
      startedAt: NOW,
      updatedAt: NOW,
      messages: [],
      medications: [],
      counts: { records: 0, withheldNotes: 0, conflicts: 0, decisions: 0 },
    }),
    "utf8",
  );
}

describe("the live endpoint", () => {
  it("serves a no-store snapshot", () => {
    const dir = fixture();
    writeEmptyRoom(dir);

    const result = liveEndpointResponse({ dir, now: () => NOW }, "GET");
    const body = JSON.parse(result.body) as { roomId: string; agents: unknown[] };

    expect(result.status).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-store, max-age=0");
    expect(result.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(body.roomId).toBe("room_rao");
    expect(body.agents).toHaveLength(1);
  });

  it("answers HEAD with headers and no body", () => {
    const dir = fixture();
    writeEmptyRoom(dir);

    const result = liveEndpointResponse({ dir, now: () => NOW }, "HEAD");

    expect(result.status).toBe(200);
    expect(result.body).toBe("");
    expect(result.headers["Content-Type"]).toBe("application/json; charset=utf-8");
  });

  it("rejects other methods", () => {
    const result = liveEndpointResponse({ dir: fixture() }, "POST");

    expect(result.status).toBe(405);
    expect(result.headers.Allow).toBe("GET, HEAD");
    expect(JSON.parse(result.body)).toEqual({ error: "method not allowed" });
  });

  it("serves an empty snapshot before any agent writes", () => {
    const result = liveEndpointResponse({ dir: fixture(), now: () => NOW }, "GET");
    const body = JSON.parse(result.body) as { agents: unknown[]; roomId: string | null };

    expect(result.status).toBe(200);
    expect(body.agents).toEqual([]);
    expect(body.roomId).toBeNull();
  });

  it("denies the private store directory to the browser", async () => {
    const env = { command: "serve", mode: "development" } as ConfigEnv;
    const loaded = await loadConfigFromFile(env, resolve("vite.config.ts"));

    expect(loaded?.config.server?.fs?.deny).toContain("**/var/**");
  });
});
