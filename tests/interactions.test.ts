import { describe, expect, it } from "vitest";
import { findInteractions, interactionPack, normalize } from "../server/domain/interactions";
import type { MedicationSummary } from "../src/shared/types";

const warfarin: MedicationSummary = {
  name: "warfarin",
  dose: "5 mg",
  since: "2024-02-11",
  sourceEventId: "rohan:e0001",
};

const atorvastatin: MedicationSummary = {
  name: "atorvastatin",
  dose: "20 mg",
  since: "2025-01-08",
  sourceEventId: "rohan:e0002",
};

describe("the interaction pack", () => {
  it("normalises names before matching", () => {
    expect(normalize("  Trimethoprim  ")).toBe("trimethoprim");
    expect(normalize("Warfarin (5 mg)")).toBe("warfarin 5 mg");
  });

  it("finds the golden-path pair", () => {
    const findings = findInteractions("trimethoprim", [warfarin, atorvastatin]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.existingMed).toBe("warfarin");
    expect(findings[0]?.severity).toBe("high");
  });

  it("does not invent an interaction for an unrelated medicine", () => {
    expect(findInteractions("atorvastatin", [warfarin])).toHaveLength(0);
  });

  it("does not match a medicine against itself", () => {
    expect(findInteractions("warfarin", [warfarin])).toHaveLength(0);
  });

  it("ships a demo pack that names its limits", () => {
    expect(interactionPack.pairs.length).toBeGreaterThan(5);
    expect(interactionPack.disclaimer.toLowerCase()).toContain("not clinical guidance");
  });
});
