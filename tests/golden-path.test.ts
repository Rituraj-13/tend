import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDemo } from "../server/domain/demo";
import type { DemoPayload } from "../src/shared/types";

let payload: DemoPayload;
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "tend-golden-"));
  payload = runDemo({ root });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the golden path", () => {
  it("starts with a person and ends with a brief", () => {
    expect(payload.transcript[0]?.sender).toBe("Maya");
    expect(payload.transcript.at(-1)?.tone).toBe("handover");
    expect(payload.brief.decisions).toHaveLength(1);
  });

  it("sends one agent to the other by name", () => {
    const peerCheck = payload.transcript.find((message) => message.tone === "peer-check");
    expect(peerCheck?.target).toBe("Rohan's agent");
    expect(peerCheck?.body).toContain("```tend");
  });

  it("raises a conflict with evidence from both stores", () => {
    expect(payload.conflict.state).toBe("resolved");
    expect(payload.conflict.evidenceEventIds).toHaveLength(2);
    expect(payload.conflict.evidenceEventIds.some((id) => id.startsWith("maya:"))).toBe(true);
    expect(payload.conflict.evidenceEventIds.some((id) => id.startsWith("rohan:"))).toBe(true);
  });

  it("records the decision against the message that approved it", () => {
    const source = payload.transcript.find((message) => message.id === payload.decision.messageId);
    expect(source?.sender).toBe("Maya");
    expect(source?.body.toLowerCase()).toContain("decision:");
    expect(payload.decision.approvedBy).toBe("Maya");
    expect(payload.decision.conflictId).toBe(payload.conflict.id);
  });

  it("merges both owners into one brief", () => {
    const names = payload.brief.medications.map((med) => med.name);
    expect(names).toContain("trimethoprim");
    expect(names).toContain("warfarin");
    expect(payload.brief.audit.owners).toBe(2);
    expect(payload.brief.audit.withheld).toBe(4);
    expect(payload.brief.questions[0]).toContain("Trimethoprim");
  });

  it("has a beat for every step in the story", () => {
    const beats = payload.beats.map((beat) => beat.key);
    expect(beats).toEqual([
      "arrival",
      "record",
      "peer-check",
      "peer-reply",
      "conflict",
      "pharmacy",
      "decision",
      "brief",
    ]);
    for (const beat of payload.beats) {
      expect(payload.transcript.some((message) => message.beat === beat.key)).toBe(true);
    }
  });

  it("counts two owners and two agents", () => {
    expect(payload.metrics.owners).toBe(2);
    expect(payload.metrics.agents).toBe(2);
    expect(payload.slices.map((slice) => slice.key)).toEqual(["maya", "rohan"]);
    expect(payload.metrics.privateRecords).toBe(
      payload.slices.reduce((total, slice) => total + slice.records, 0),
    );
  });
});
