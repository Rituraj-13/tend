import { useMemo } from "react";
import type { LiveAgent, LiveAgentState, LiveSnapshot } from "../../shared/live";
import { formatClock, title } from "../../shared/format";
import { ArrowRight, Mark, Sprig } from "../components/Icons";
import { LiveTranscript } from "./LiveTranscript";
import { useLiveSnapshot } from "./useLiveSnapshot";

const AGENT_COLOR: Record<string, string> = {
  maya: "sage",
  rohan: "clay",
};

export function LivePage() {
  const { snapshot, phase, error, lastGoodAt, refresh } = useLiveSnapshot();

  const announcement = useMemo(() => {
    if (phase === "loading") return "Connecting to the live room.";
    if (!snapshot) return "Live feed unavailable.";
    if (snapshot.agents.length === 0) return "Connected. Waiting for the first agent.";
    const live = snapshot.agents.filter((agent) => agent.state === "live").length;
    const stale = snapshot.agents.filter((agent) => agent.state === "stale").length;
    const total = snapshot.agents.length;
    if (stale > 0) {
      return `${stale} of ${total} agents stale. ${live} of ${total} live.`;
    }
    return `Live. ${live} of ${total} agents. ${snapshot.messages.length} messages.`;
  }, [phase, snapshot]);

  return (
    <div className="live">
      <a className="skip" href="#live-main">
        Skip to the live room
      </a>

      <header className="live__bar">
        <div className="shell live__bar-inner">
          <a className="wordmark wordmark--small" href="/" aria-label="Tend, back to the demo">
            <Mark width={20} height={20} />
            <span>Tend</span>
          </a>
          <span className="live__tag">
            <span className="live__dot" aria-hidden="true" />
            Live room
          </span>
          <a className="live__nav" href="/">
            Replay the demo
            <ArrowRight width={12} height={12} />
          </a>
        </div>
      </header>

      <main id="live-main" className="shell live__main" tabIndex={-1}>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <section className="live__head">
          <span className="eyebrow">Live room</span>
          <h1 className="live__title">Two agents. One room.</h1>
          <p className="live__lede">
            The same Switch room the agents are in, read-only. Names, doses and room
            messages cross the line. Private notes and appointments never do.
          </p>
        </section>

        <StatusBar
          snapshot={snapshot}
          phase={phase}
          lastGoodAt={lastGoodAt}
          onRefresh={refresh}
        />

        {snapshot?.degraded ? <DegradedBanner snapshot={snapshot} /> : null}

        {phase === "unreachable" && snapshot !== null ? (
          <p className="live__warning" role="alert">
            Live feed unavailable. Showing the last update from{" "}
            {lastGoodAt ? formatClock(lastGoodAt) : "earlier"}.
            {error ? <span className="live__warning-detail"> {error}</span> : null}
          </p>
        ) : null}

        {snapshot === null ? (
          phase === "unreachable" ? (
            <LiveOffline error={error} onRetry={refresh} />
          ) : (
            <LiveLoading />
          )
        ) : snapshot.agents.length === 0 ? (
          <LiveWaiting />
        ) : (
          <div className="live__grid">
            <LiveTranscript messages={snapshot.messages} roomId={snapshot.roomId} />
            <aside className="live__side" aria-label="Agents in this room">
              {snapshot.agents.map((agent) => (
                <LiveAgentCard key={agent.key} agent={agent} />
              ))}
            </aside>
          </div>
        )}

        <footer className="live__foot">
          <p>
            <strong>Privacy.</strong> Room messages are public to the room. Store notes
            and appointments never leave the agent process; only their counts are
            published.
          </p>
          <p className="live__foot-warn">
            Not a medical device. Not medical advice. A clinician decides.
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatusBar({
  snapshot,
  phase,
  lastGoodAt,
  onRefresh,
}: {
  snapshot: LiveSnapshot | null;
  phase: "loading" | "ready" | "unreachable";
  lastGoodAt: string | null;
  onRefresh: () => void;
}) {
  const state = overallState(snapshot, phase);
  const live = snapshot?.agents.filter((agent) => agent.state === "live").length ?? 0;
  const total = snapshot?.agents.length ?? 0;
  const updated = lastGoodAt ?? snapshot?.generatedAt ?? null;

  return (
    <div className="live__statusbar">
      <span className={`live-chip live-chip--${state.tone}`}>
        <span className="live-chip__dot" aria-hidden="true" />
        {state.label}
      </span>
      <span className="live__status-meta">
        {total > 0 ? `${live} of ${total} agents` : "No agents yet"}
      </span>
      <span className="live__status-meta">
        {updated ? `synced ${secondsAgo(updated)}` : "waiting for the first snapshot"}
      </span>
      <button type="button" className="button button--ghost button--sm live__refresh" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}

function overallState(
  snapshot: LiveSnapshot | null,
  phase: "loading" | "ready" | "unreachable",
): { label: string; tone: "live" | "stale" | "offline" | "waiting" } {
  if (phase === "unreachable") return { label: "Offline", tone: "offline" };
  if (snapshot === null) return { label: "Connecting", tone: "waiting" };
  if (snapshot.agents.length === 0) return { label: "Waiting", tone: "waiting" };
  if (snapshot.agents.every((agent) => agent.state === "closed")) {
    return { label: "Closed", tone: "offline" };
  }
  if (snapshot.agents.some((agent) => agent.state === "stale")) {
    return { label: "Stale", tone: "stale" };
  }
  return { label: "Live", tone: "live" };
}

function DegradedBanner({ snapshot }: { snapshot: LiveSnapshot }) {
  return (
    <div className="live__degraded" role="status">
      <strong>Partial view.</strong>{" "}
      {snapshot.issues
        .map((issue) => `${title(issue.key)}'s live file could not be read.`)
        .join(" ")}{" "}
      The rest of the room is unaffected.
    </div>
  );
}

function LiveLoading() {
  return (
    <div className="live__panel" aria-busy="true">
      <span className="live__panel-label">Connecting</span>
      <p>Looking for the agents' live projections in the room.</p>
    </div>
  );
}

function LiveOffline({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="live__panel live__panel--offline" role="alert">
      <span className="live__panel-label">Live feed unavailable</span>
      <p>
        The interface cannot reach <code className="mono">/live/snapshot</code>. It only
        exists while the dev server is running.
      </p>
      {error ? <p className="live__panel-detail">{error}</p> : null}
      <button type="button" className="button button--sm" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function LiveWaiting() {
  return (
    <div className="live__panel">
      <span className="live__panel-label">Waiting for the first agent</span>
      <p>
        Nobody has connected yet. Start an agent process with a live directory and this
        page fills in. The endpoint reads <code className="mono">var/live/*.json</code>,
        one file per agent.
      </p>
      <pre className="live__snippet">
        <code>{`TEND_LIVE_DIR=var/live npm run agent`}</code>
      </pre>
      <p className="live__panel-detail">
        See <code className="mono">docs/LIVE.md</code> for the two-terminal runbook.
        The landing page is an offline replay; this page is the live path.
      </p>
    </div>
  );
}

function LiveAgentCard({ agent }: { agent: LiveAgent }) {
  const color = AGENT_COLOR[agent.key] ?? "ink";

  return (
    <article className={`live-agent live-agent--${agent.state}`}>
      <header className="live-agent__head">
        <span className={`monogram monogram--agent monogram--${color}`}>
          <Sprig width={17} height={17} />
        </span>
        <div className="live-agent__who">
          <h2 className="live-agent__name">{agent.agent}</h2>
          <p className="live-agent__owner">
            {agent.owner} · {agent.person}
          </p>
        </div>
      </header>

      <p
        className={`live-agent__state live-agent__state--${agent.state}`}
        aria-label={`${stateWord(agent.state)}. ${describeStamp(agent)}`}
      >
        <span className="live-agent__dot" aria-hidden="true" />
        {stateWord(agent.state)}
        <span className="live-agent__stamp" aria-hidden="true">
          {describeStamp(agent)}
        </span>
      </p>

      <dl className="live-agent__counts">
        <div>
          <dt>Records</dt>
          <dd>{agent.counts.records}</dd>
        </div>
        <div>
          <dt>Notes withheld</dt>
          <dd>{agent.counts.withheldNotes}</dd>
        </div>
        <div>
          <dt>Conflicts</dt>
          <dd>{agent.counts.conflicts}</dd>
        </div>
        <div>
          <dt>Decisions</dt>
          <dd>{agent.counts.decisions}</dd>
        </div>
      </dl>

      <div className="live-agent__meds">
        <span className="eyebrow">Shared medications</span>
        {agent.medications.length === 0 ? (
          <p className="live-agent__none">No active medications shared.</p>
        ) : (
          <ul className="live-agent__medlist">
            {agent.medications.map((medication) => (
              <li key={medication.sourceEventId} className="live-agent__med">
                <span>{title(medication.name)}</span>
                <em>{medication.dose}</em>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="live-agent__note">Notes stay in the store. Only counts cross.</p>
    </article>
  );
}

function stateWord(state: LiveAgentState): string {
  if (state === "live") return "Live";
  if (state === "stale") return "Stale";
  return "Closed";
}

function describeStamp(agent: LiveAgent): string {
  if (agent.state === "live") return `updated ${secondsAgo(agent.updatedAt)}`;
  if (agent.state === "stale") return `last update ${secondsAgo(agent.updatedAt)}`;
  return "agent stopped";
}

function secondsAgo(value: string): string {
  const then = Date.parse(value);
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return formatClock(value);
}
