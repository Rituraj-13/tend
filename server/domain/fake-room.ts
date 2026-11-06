import type { Beat, ChatMessage, Tone } from "../../src/shared/types";
import type { IncomingMessage, PostOptions, Room } from "./room";

export class FakeRoom implements Room {
  readonly name: string;
  readonly messages: ChatMessage[] = [];
  private readonly agents = new Set<string>();
  private sequence = 0;
  private beat: Beat = "arrival";
  private clock: () => string;

  constructor(name: string, clock: () => string) {
    this.name = name;
    this.clock = clock;
  }

  registerAgent(name: string): void {
    this.agents.add(name);
  }

  setClock(clock: () => string): void {
    this.clock = clock;
  }

  mark(beat: Beat): void {
    this.beat = beat;
  }

  post(body: string, options: PostOptions): string {
    return this.record(body, options, null);
  }

  send(target: string, body: string, options: PostOptions): string {
    return this.record(body, options, target);
  }

  message(id: string): ChatMessage {
    const found = this.messages.find((message) => message.id === id);
    if (!found) throw new Error(`unknown message ${id}`);
    return found;
  }

  humanPost(
    name: string,
    body: string,
    threadId: string | null = null,
    tone: Tone = "plain",
  ): IncomingMessage {
    const id = this.record(body, { sender: name, threadId, tone }, null);
    const message = this.message(id);
    return {
      id,
      sender: message.sender,
      senderKind: "human",
      body: message.body,
      threadId: message.threadId ?? null,
      at: message.at,
      addressed: true,
    };
  }

  incoming(id: string): IncomingMessage {
    const message = this.message(id);
    return {
      id,
      sender: message.sender,
      senderKind: this.agents.has(message.sender) ? "agent" : "human",
      body: message.body,
      threadId: message.threadId ?? null,
      at: message.at,
      addressed: true,
    };
  }

  private record(body: string, options: PostOptions, target: string | null): string {
    this.sequence += 1;
    const tone: Tone = options.tone ?? "agent";
    const message: ChatMessage = {
      id: `m_${String(this.sequence).padStart(3, "0")}`,
      sender: options.sender,
      senderKind: this.agents.has(options.sender) ? "agent" : "human",
      body,
      target,
      threadId: options.threadId ?? null,
      at: this.clock(),
      beat: this.beat,
      tone,
    };
    this.messages.push(message);
    return message.id;
  }
}
