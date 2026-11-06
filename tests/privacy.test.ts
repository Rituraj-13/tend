import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDemo } from "../server/domain/demo";
import type { DemoPayload } from "../src/shared/types";

const PRIVATE_NOTES = [
  "INR check",
  "Result 2.4",
  "Annual review",
  "Bruise on left forearm",
  "Reports feeling tired",
];

let payload: DemoPayload;
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "tend-privacy-"));
  payload = runDemo({ root });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the privacy boundary", () => {
  it("never puts note text in the peer reply", () => {
    const wire = JSON.stringify(payload.shared.reply);
    for (const note of PRIVATE_NOTES) {
      expect(wire).not.toContain(note);
    }
  });

  it("shares only the fixed medication projection", () => {
    for (const item of payload.shared.reply.active) {
      expect(Object.keys(item).sort()).toEqual(["dose", "name", "since", "sourceEventId"]);
    }
  });

  it("reports the count of withheld notes instead of their content", () => {
    expect(payload.shared.reply.withheld).toBe(4);
    expect(payload.shared.note).toBe("2 medications shared. 4 notes withheld.");
  });

  it("keeps the withheld notes out of the brief", () => {
    const brief = JSON.stringify(payload.brief);
    for (const note of PRIVATE_NOTES) {
      expect(brief).not.toContain(note);
    }
    expect(payload.brief.audit.withheld).toBe(4);
  });
});
