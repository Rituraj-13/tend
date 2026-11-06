import type { IncomingMessage } from "../domain/room";
import { describeError, SwitchRoom } from "./client";
import type { SwitchConfig } from "./config";

export interface RunHandlers {
  handle(message: IncomingMessage): void | string[];
}

export type HandlerFactory = (room: SwitchRoom) => RunHandlers;

export async function runAgent(
  config: SwitchConfig,
  createHandlers: HandlerFactory,
): Promise<void> {
  const room = new SwitchRoom(config);
  const handlers = createHandlers(room);
  room.onMessage((message) => {
    try {
      handlers.handle(message);
    } catch (error) {
      console.error(`[switch] handler failed: ${describeError(error)}`);
    }
  });

  try {
    await room.connect();
    await room.connectToRoom(config.roomId);
    console.log(
      `[switch] connected as ${config.agentId}, room ${config.roomId}, connection ${config.connectionId}`,
    );
    await waitForShutdown();
  } finally {
    await room.close();
    console.log("[switch] closed");
  }
}

function waitForShutdown(): Promise<void> {
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
