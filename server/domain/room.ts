import type { ChatMessage, Tone } from "../../src/shared/types";

export interface PostOptions {
  sender: string;
  threadId?: string | null;
  tone?: Tone;
}

export interface Room {
  post(body: string, options: PostOptions): string;
  send(target: string, body: string, options: PostOptions): string;
  message(id: string): ChatMessage;
}

export interface IncomingMessage {
  id: string;
  sender: string;
  senderKind: "human" | "agent";
  body: string;
  threadId: string | null;
  at: string;
  addressed: boolean;
}
