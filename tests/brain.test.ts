import { describe, expect, it } from "vitest";
import { decodeBlock, encodeBlock, extractPrescription } from "../server/domain/brain";

describe("the rule extractor", () => {
  it("reads the golden-path sentence", () => {
    const prescription = extractPrescription(
      "Mum started trimethoprim 100 mg today. Dr Rao prescribed it.",
      "2026-11-03",
    );
    expect(prescription).toEqual({
      name: "trimethoprim",
      dose: "100 mg",
      startedOn: "2026-11-03",
      raw: "Mum started trimethoprim 100 mg today. Dr Rao prescribed it.",
    });
  });

  it("ignores a stop instruction", () => {
    expect(
      extractPrescription("Mum stopped trimethoprim 100 mg today.", "2026-11-03"),
    ).toBeNull();
  });

  it("ignores a decision message", () => {
    expect(
      extractPrescription("Decision: hold the new med until Dr Rao confirms.", "2026-11-03"),
    ).toBeNull();
  });

  it("reads an explicit start date", () => {
    const prescription = extractPrescription(
      "Started warfarin 5 mg on 2026-10-30.",
      "2026-11-03",
    );
    expect(prescription?.startedOn).toBe("2026-10-30");
  });
});

describe("the peer payload", () => {
  it("round trips a request", () => {
    const body = encodeBlock({
      v: 1,
      type: "med_check",
      requestId: "q_0001",
      candidate: {
        name: "trimethoprim",
        dose: "100 mg",
        started: "2026-11-03",
        sourceEventId: "maya:e0003",
      },
    });
    const decoded = decodeBlock(body);
    expect(decoded?.type).toBe("med_check");
    expect(decoded?.requestId).toBe("q_0001");
  });

  it("rejects a malformed block", () => {
    expect(decodeBlock("```tend\n{not json}\n```")).toBeNull();
    expect(decodeBlock("no payload here")).toBeNull();
  });

  it("rejects an unknown protocol version", () => {
    const block = "```tend\n" + JSON.stringify({ v: 2, type: "med_check" }) + "\n```";
    expect(decodeBlock(block)).toBeNull();
  });
});
