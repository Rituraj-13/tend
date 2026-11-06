import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { LIVE_STALE_AFTER_MS } from "../../src/shared/live";
import { readLiveSnapshot } from "./merge";

export const LIVE_PATH = "/live/snapshot";

export interface LivePluginOptions {
  dir?: string;
  staleAfterMs?: number;
  now?: () => string;
}

export interface LiveEndpointResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export function liveEndpointResponse(
  options: LivePluginOptions,
  method: string,
): LiveEndpointResult {
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "GET, HEAD" },
      body: JSON.stringify({ error: "method not allowed" }),
    };
  }

  try {
    const snapshot = readLiveSnapshot({
      dir: resolve(process.cwd(), options.dir ?? "var/live"),
      now: options.now,
      staleAfterMs: options.staleAfterMs ?? LIVE_STALE_AFTER_MS,
    });
    return {
      status: 200,
      headers: JSON_HEADERS,
      body: method === "HEAD" ? "" : JSON.stringify(snapshot),
    };
  } catch {
    return {
      status: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: "live snapshot unavailable" }),
    };
  }
}

type Next = (error?: unknown) => void;

function middleware(options: LivePluginOptions) {
  return (request: IncomingMessage, response: ServerResponse, next: Next): void => {
    const pathname = (request.url ?? "/").split("?")[0];
    if (pathname !== LIVE_PATH) {
      next();
      return;
    }
    const result = liveEndpointResponse(options, request.method ?? "GET");
    response.statusCode = result.status;
    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }
    response.end(result.body);
  };
}

export function tendLivePlugin(options: LivePluginOptions = {}): Plugin {
  return {
    name: "tend-live",
    configureServer(server) {
      server.middlewares.use(middleware(options));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(options));
    },
  };
}
