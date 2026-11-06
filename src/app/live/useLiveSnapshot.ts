import { useCallback, useEffect, useState } from "react";
import type { LiveSnapshot } from "../../shared/live";
import { LIVE_POLL_INTERVAL_MS, isLiveSnapshot } from "../../shared/live";

export interface LiveFeedOptions {
  endpoint?: string;
  intervalMs?: number;
}

export interface LiveFeed {
  snapshot: LiveSnapshot | null;
  phase: "loading" | "ready" | "unreachable";
  error: string | null;
  lastGoodAt: string | null;
  refresh: () => void;
}

export function useLiveSnapshot(options: LiveFeedOptions = {}): LiveFeed {
  const endpoint = options.endpoint ?? "/live/snapshot";
  const intervalMs = options.intervalMs ?? LIVE_POLL_INTERVAL_MS;
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [phase, setPhase] = useState<LiveFeed["phase"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastGoodAt, setLastGoodAt] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let timer: number | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (disposed) return;
      timer = window.setTimeout(() => {
        timer = null;
        void run();
      }, intervalMs);
    };

    const run = async (): Promise<void> => {
      if (disposed || controller !== null) return;
      if (document.hidden) {
        schedule();
        return;
      }

      const active = new AbortController();
      controller = active;
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: active.signal,
        });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Live feed not found."
              : `Live feed returned ${response.status}.`,
          );
        }
        const payload: unknown = await response.json();
        if (!isLiveSnapshot(payload)) {
          throw new Error("Live feed returned an unexpected shape.");
        }
        if (disposed) return;
        setSnapshot(payload);
        setPhase("ready");
        setError(null);
        setLastGoodAt(new Date().toISOString());
      } catch (caught) {
        if (disposed || active.signal.aborted) return;
        setPhase("unreachable");
        setError(describeError(caught));
      } finally {
        const aborted = active.signal.aborted;
        if (controller === active) controller = null;
        if (!disposed && !aborted) schedule();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        clearTimer();
        return;
      }
      clearTimer();
      void run();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void run();

    return () => {
      disposed = true;
      controller?.abort();
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endpoint, intervalMs, nonce]);

  return { snapshot, phase, error, lastGoodAt, refresh };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return "Live feed unavailable.";
}
