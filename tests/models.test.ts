import { describe, expect, it } from "vitest";
import { InvalidTransition, dismissConflict, resolveConflict } from "../server/domain/models";
import type { Conflict } from "../src/shared/types";

const conflict: Conflict = {
  id: "c_test",
  state: "open",
  finding: {
    newMed: "trimethoprim",
    existingMed: "warfarin",
    severity: "high",
    reason: "Test reason.",
    source: "test",
  },
  raisedBy: "Maya's agent",
  evidenceEventIds: ["maya:e0003", "rohan:e0001"],
  threadId: "m_001",
  messageId: "m_006",
  raisedAt: "2026-11-03T09:14:00.000Z",
  decisionId: null,
};

describe("the conflict state machine", () => {
  it("moves from open to resolved and keeps the decision id", () => {
    const resolved = resolveConflict(conflict, "d_0001");
    expect(resolved.state).toBe("resolved");
    expect(resolved.decisionId).toBe("d_0001");
    expect(resolved.evidenceEventIds).toEqual(conflict.evidenceEventIds);
  });

  it("refuses a second resolution", () => {
    const resolved = resolveConflict(conflict, "d_0001");
    expect(() => resolveConflict(resolved, "d_0002")).toThrow(InvalidTransition);
  });

  it("refuses a dismissal after a resolution", () => {
    const resolved = resolveConflict(conflict, "d_0001");
    expect(() => dismissConflict(resolved)).toThrow(InvalidTransition);
  });

  it("keeps the evidence when dismissed", () => {
    const dismissed = dismissConflict(conflict);
    expect(dismissed.state).toBe("dismissed");
    expect(dismissed.evidenceEventIds).toEqual(conflict.evidenceEventIds);
  });
});
