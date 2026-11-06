import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDemo } from "../server/domain/demo";
import { buildBoard } from "../src/app/switchboard-model";
import type { DemoPayload } from "../src/shared/types";

let payload: DemoPayload;
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "tend-switchboard-"));
  payload = runDemo({ root });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function undefinedPaths(value: unknown, path = ""): string[] {
  if (value === undefined) return [path || "(root)"];
  if (value === null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => undefinedPaths(item, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      undefinedPaths(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("the switchboard model", () => {
  it("keeps the room locked and empty when the power is off", () => {
    const board = buildBoard(payload, "off");

    expect(board.switch.checked).toBe(false);
    expect(board.room.state).toBe("locked");
    expect(board.room.thread).toEqual([]);
    expect(board.room.count).toBe("10 held");
    expect(board.room.empty).not.toBeNull();
    expect(board.room.sidebar).toHaveLength(4);
    expect(board.room.sidebar.every((row) => row.value === "Locked")).toBe(true);
    expect(board.room.members.every((member) => member.state === "LOCAL")).toBe(true);
    expect(board.room.members.every((member) => member.tag === "AGENT")).toBe(true);
    expect(board.room.moreHref).toBeNull();
    expect(board.wires.state).toBe("open");
  });

  it("fills five story entries when the power is on", () => {
    const board = buildBoard(payload, "on");

    expect(board.switch.checked).toBe(true);
    expect(board.room.state).toBe("live");
    expect(board.room.empty).toBeNull();
    expect(board.room.thread).toHaveLength(5);
    expect(board.room.count).toBe("5 of 10");
    expect(board.room.thread.map((entry) => entry.kind)).toEqual([
      "human",
      "protocol",
      "protocol",
      "conflict",
      "decision",
    ]);
    expect(board.room.moreHref).toBe("#room");
    expect(board.wires.state).toBe("closed");
  });

  it("names both sides of the conflict from the demo medications", () => {
    const board = buildBoard(payload, "on");
    const conflict = board.room.thread.find((entry) => entry.kind === "conflict");

    expect(conflict).toBeDefined();
    if (conflict?.kind !== "conflict") throw new Error("Expected a conflict entry.");
    expect(conflict.newMed).toContain("Trimethoprim");
    expect(conflict.existingMed).toContain("Warfarin");
    expect(conflict.severity).toBe(payload.conflict.finding.severity);
  });

  it("records the decision with the owner who approved it", () => {
    const board = buildBoard(payload, "on");
    const decision = board.room.thread.find((entry) => entry.kind === "decision");

    expect(decision).toBeDefined();
    if (decision?.kind !== "decision") throw new Error("Expected a decision entry.");
    expect(decision.approvedBy).toBe("Maya");
    expect(decision.decisionId).toBe(payload.decision.id);
    expect(board.room.members.every((member) => member.tag === "AGENT")).toBe(true);
    expect(board.room.members.every((member) => member.state === "IN ROOM")).toBe(true);
  });

  it("uses live sidebar values in the powered room", () => {
    const board = buildBoard(payload, "on");
    const history = board.room.sidebar.find((row) => row.key === "history");
    const decisions = board.room.sidebar.find((row) => row.key === "decisions");

    expect(history?.value).toBe("10 messages");
    expect(decisions?.value).toBe("1 · Maya");
    expect(board.room.sidebar.every((row) => row.state === "live")).toBe(true);
  });

  it("names the blind record in each private terminal", () => {
    const board = buildBoard(payload, "off");
    const maya = board.terminals.find((terminal) => terminal.id === "maya");
    const rohan = board.terminals.find((terminal) => terminal.id === "rohan");
    const host = board.terminals.find((terminal) => terminal.id === "host");

    expect(maya?.gap.label).toBe("CANNOT SEE");
    expect(maya?.gap.fact).toContain("Warfarin");
    expect(rohan?.gap.label).toBe("CANNOT SEE");
    expect(rohan?.gap.fact).toContain("Trimethoprim");
    expect(host?.gap.label).toBe("NO ROUTE");
  });

  it("switches the gap ledger to received facts", () => {
    const board = buildBoard(payload, "on");
    const maya = board.terminals.find((terminal) => terminal.id === "maya");
    const rohan = board.terminals.find((terminal) => terminal.id === "rohan");
    const host = board.terminals.find((terminal) => terminal.id === "host");

    expect(maya?.gap.label).toBe("RECEIVED");
    expect(maya?.gap.id).toMatch(/^rohan:/);
    expect(rohan?.gap.label).toBe("ANSWERED");
    expect(rohan?.gap.id).toMatch(/^maya:/);
    expect(host?.gap.label).toBe("ROUTED");
  });

  it("never reads undefined and is deterministic for the same demo", () => {
    const off = buildBoard(payload, "off");
    const on = buildBoard(payload, "on");

    expect(undefinedPaths(off)).toEqual([]);
    expect(undefinedPaths(on)).toEqual([]);
    expect(buildBoard(payload, "off")).toEqual(off);
    expect(buildBoard(payload, "on")).toEqual(on);
  });
});
