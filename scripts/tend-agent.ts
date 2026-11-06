import { join } from "node:path";
import { seedMaya, seedRohan } from "../server/domain/demo";
import { CareAgent } from "../server/domain/policy";
import { Store } from "../server/domain/store";
import { loadConfig } from "../server/switch/config";
import { runAgent } from "../server/switch/run";

const OWNER = required("TEND_OWNER");
const PERSON = required("TEND_PERSON");
const AGENT_NAME = required("TEND_AGENT_NAME");
const PEER_OWNER = required("TEND_PEER_OWNER");
const PEER_AGENT = required("TEND_PEER_AGENT");
const STORE_KEY = process.env.TEND_STORE_KEY?.trim() || OWNER.toLowerCase();
const STORE_ROOT = process.env.TEND_STORE_ROOT?.trim() || "var";

const store = new Store(STORE_KEY, { root: join(process.cwd(), STORE_ROOT) });

if (process.argv.includes("--seed")) {
  if (store.eventList().length > 0) {
    console.log(`[tend] ${STORE_KEY} already has ${store.eventList().length} records, not seeding`);
  } else if (STORE_KEY === "maya") {
    seedMaya(store);
    console.log("[tend] seeded Maya's store");
  } else if (STORE_KEY === "rohan") {
    seedRohan(store);
    console.log("[tend] seeded Rohan's store");
  } else {
    throw new Error(`No seed data for ${STORE_KEY}. Use TEND_STORE_KEY=maya or rohan.`);
  }
}

const config = loadConfig();

await runAgent(config, (room) => {
  return new CareAgent({
    owner: OWNER,
    agentName: AGENT_NAME,
    peerOwner: PEER_OWNER,
    peerAgent: PEER_AGENT,
    person: PERSON,
    store,
    room,
    clock: () => new Date().toISOString(),
  });
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. It names this agent's side of the room.`);
  return value;
}
