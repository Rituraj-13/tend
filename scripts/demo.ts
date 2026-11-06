import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DemoPayload } from "../src/shared/types";
import { runDemo } from "../server/domain/demo";

const root = process.cwd();
const payload = runDemo({ root });

writeJson(join(root, "public", "demo.json"), payload);
writeJson(join(root, "src", "generated", "demo.json"), payload);

printRun(payload);

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printRun(data: DemoPayload): void {
  const lines: string[] = [];
  lines.push("");
  lines.push(`Tend · ${data.scenario.room} · ${data.scenario.provider}`);
  lines.push("-".repeat(64));
  for (const message of data.transcript) {
    const where = message.target ? ` -> @${message.target}` : "";
    lines.push("");
    lines.push(`[${message.at.slice(11, 16)}] ${message.sender}${where}`);
    for (const line of message.body.split("\n")) lines.push(`  ${line}`);
  }
  lines.push("");
  lines.push("-".repeat(64));
  lines.push(`Conflict ${data.conflict.id}: ${data.conflict.state}`);
  lines.push(`Decision ${data.decision.id}: ${data.decision.text}`);
  lines.push(
    `Brief: ${data.brief.medications.length} medications, ${data.brief.decisions.length} decision, ${data.brief.audit.withheld} notes withheld`,
  );
  lines.push("Wrote public/demo.json and src/generated/demo.json");
  console.log(lines.join("\n"));
}
