import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface SwitchConfig {
  baseUrl: string;
  wsUrl: string;
  apiKey: string;
  agentId: string;
  roomId: string;
  registrationToken: string;
  connectionId: string;
}

export interface RegistrationConfig {
  baseUrl: string;
  registrationToken: string;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

export function loadEnvFileIfPresent(customPath?: string): void {
  const filePath = customPath || process.env.ENV_FILE || ".env";
  if (existsSync(filePath)) {
    try {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(resolve(filePath));
      }
    } catch {
      // Ignore if loadEnvFile fails or is unavailable
    }
  }
}

function readBaseUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.SWITCH_BASE_URL?.trim() || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SWITCH_BASE_URL must be an http(s) URL, got ${JSON.stringify(raw)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`SWITCH_BASE_URL must use http or https, got ${url.protocol}`);
  }
  return url.toString().replace(/\/$/, "");
}

function deriveWsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SwitchConfig {
  if (env === process.env) {
    loadEnvFileIfPresent();
  }
  const baseUrl = readBaseUrl(env);
  const apiKey = env.SWITCH_API_KEY?.trim() || null;
  const agentId = env.SWITCH_AGENT_ID?.trim() || null;
  const roomId = env.SWITCH_ROOM_ID?.trim() || null;
  const registrationToken = env.SWITCH_REGISTRATION_TOKEN?.trim() || null;
  const connectionId = env.SWITCH_CONNECTION_ID?.trim() || randomUUID();

  if (apiKey === null || agentId === null || roomId === null || registrationToken === null) {
    const missing = [
      apiKey === null ? "SWITCH_API_KEY: agent API key returned by registration" : null,
      agentId === null ? "SWITCH_AGENT_ID: id returned by registration" : null,
      roomId === null ? "SWITCH_ROOM_ID: Switch room id the agent joins" : null,
      registrationToken === null
        ? "SWITCH_REGISTRATION_TOKEN: registration token used to register the agent"
        : null,
    ].filter((line): line is string => line !== null);

    throw new Error(
      [
        "Missing Switch configuration:",
        ...missing.map((line) => `  ${line}`),
        `SWITCH_BASE_URL defaults to ${DEFAULT_BASE_URL}.`,
      ].join("\n"),
    );
  }

  return {
    baseUrl,
    wsUrl: deriveWsUrl(baseUrl),
    apiKey,
    agentId,
    roomId,
    registrationToken,
    connectionId,
  };
}

export function loadRegistrationConfig(
  env: NodeJS.ProcessEnv = process.env,
): RegistrationConfig {
  if (env === process.env) {
    loadEnvFileIfPresent();
  }
  const baseUrl = readBaseUrl(env);
  const registrationToken = env.SWITCH_REGISTRATION_TOKEN?.trim();
  if (!registrationToken) {
    throw new Error(
      "Missing SWITCH_REGISTRATION_TOKEN. It is the registration token printed by the Switch instance.",
    );
  }
  return { baseUrl, registrationToken };
}
