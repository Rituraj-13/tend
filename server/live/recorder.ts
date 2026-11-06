import type { ChatMessage } from "../../src/shared/types";
import type { PostOptions, Room } from "../domain/room";

export interface RecordingRoomOptions {
  onOutbound(message: ChatMessage): void;
}

export class RecordingRoom implements Room {
  private readonly inner: Room;
  private readonly options: RecordingRoomOptions;

  constructor(inner: Room, options: RecordingRoomOptions) {
    this.inner = inner;
    this.options = options;
  }

  post(body: string, options: PostOptions): string {
    const id = this.inner.post(body, options);
    this.observe(id);
    return id;
  }

  send(target: string, body: string, options: PostOptions): string {
    const id = this.inner.send(target, body, options);
    this.observe(id);
    return id;
  }

  message(id: string): ChatMessage {
    return this.inner.message(id);
  }

  private observe(id: string): void {
    let message: ChatMessage;
    try {
      message = this.inner.message(id);
    } catch (error) {
      console.error(`[live] recorder could not read ${id}: ${describeError(error)}`);
      return;
    }
    try {
      this.options.onOutbound(message);
    } catch (error) {
      console.error(`[live] recorder failed: ${describeError(error)}`);
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
