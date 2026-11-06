import { join } from "node:path";
import { seedMaya, seedRohan } from "../server/domain/demo";
import { CareAgent } from "../server/domain/policy";
import { Store } from "../server/domain/store";
import { RecordingRoom } from "../server/live/recorder";
import { LiveWriter } from "../server/live/writer";
import { loadConfig, loadEnvFileIfPresent } from "../server/switch/config";
import { runAgent } from "../server/switch/run";

loadEnvFileIfPresent();

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
    console.log("[tend] seeded Maya's store with demo records");
  } else if (STORE_KEY === "rohan") {
    seedRohan(store);
    console.log("[tend] seeded Rohan's store with demo records");
  } else {
    throw new Error(`No seed data for ${STORE_KEY}. Use TEND_STORE_KEY=maya or rohan.`);
  }
} else {
  const existingCount = store.eventList().length;
  if (existingCount > 0) {
    console.log(`[tend] running with ${existingCount} existing record(s) in ${STORE_KEY}'s private store`);
  } else {
    console.log(`[tend] starting with fresh private store for ${OWNER} (${STORE_KEY})`);
  }
}

const config = loadConfig();
const clock = () => new Date().toISOString();
const liveDir = process.env.TEND_LIVE_DIR?.trim() || "var/live";

const writer = new LiveWriter({
  dir: join(process.cwd(), liveDir),
  key: STORE_KEY,
  owner: OWNER,
  agent: AGENT_NAME,
  person: PERSON,
  roomId: config.roomId,
  store,
  clock,
});
writer.start();

try {
  await runAgent(config, (switchRoom) => {
    switchRoom.onOutboundConfirmed((localId, serverId) => writer.confirm(localId, serverId));
    const room = new RecordingRoom(switchRoom, {
      onOutbound: (message) => writer.observeOutbound(message),
    });
    const agent = new CareAgent({
      owner: OWNER,
      agentName: AGENT_NAME,
      peerOwner: PEER_OWNER,
      peerAgent: PEER_AGENT,
      person: PERSON,
      store,
      room,
      clock,
    });
    return {
      handle(message) {
        writer.observeInbound(message);
        return agent.handle(message);
      },
    };
  });
} finally {
  writer.stop();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. It names this agent's side of the room.`);
  return value;
}
