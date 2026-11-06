import { describeError, SwitchRoom } from "../server/switch/client";
import { loadConfig, loadEnvFileIfPresent, loadRegistrationConfig } from "../server/switch/config";
import { registerAgent } from "../server/switch/register";
import type { SwitchConfig } from "../server/switch/config";

loadEnvFileIfPresent();

async function main(): Promise<void> {
  if (process.argv.includes("--register")) {
    const { baseUrl, registrationToken } = loadRegistrationConfig();
    const result = await registerAgent({
      baseUrl,
      registrationToken,
      name: process.env.SWITCH_AGENT_NAME?.trim() || "tend-demo",
      description:
        process.env.SWITCH_AGENT_DESCRIPTION?.trim() ||
        "Tend care agent for the medication-conflict demo",
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const config = loadConfig();
  printConfig(config);

  const room = new SwitchRoom(config);
  room.onMessage((message) => {
    console.log(`[switch] ${message.sender}: ${message.body}`);
  });

  try {
    await room.connect();
    console.log("[switch] websocket connected");
    await room.connectToRoom(config.roomId);
    console.log(`[switch] room ${config.roomId} claimed`);

    const drive = option("--drive");
    if (drive !== null) {
      room.post(drive, { sender: "human" });
      await room.flush();
      return;
    }

    console.log("[switch] waiting for messages, press Ctrl+C to stop");
    await waitForSigint();
  } finally {
    await room.close();
  }
}

function printConfig(config: SwitchConfig): void {
  console.log(`baseUrl: ${config.baseUrl}`);
  console.log(`wsUrl: ${config.wsUrl}`);
  console.log(`agentId: ${config.agentId}`);
  console.log(`roomId: ${config.roomId}`);
  console.log(`connectionId: ${config.connectionId}`);
  console.log("apiKey: [redacted]");
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv.at(index + 1);
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

function waitForSigint(): Promise<void> {
  return new Promise((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

main().catch((error: unknown) => {
  console.error(`[switch] ${describeError(error)}`);
  process.exitCode = 1;
});
