import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDemo } from "../server/domain/demo";
import type { DemoPayload } from "../src/shared/types";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "tend-generated-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the generated demo payload", () => {
  it("matches a fresh run of the golden path", () => {
    const committed = JSON.parse(
      readFileSync(join(process.cwd(), "src", "generated", "demo.json"), "utf8"),
    ) as DemoPayload;
    expect(runDemo({ root })).toEqual(committed);
  });
});
