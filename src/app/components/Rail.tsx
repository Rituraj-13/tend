import type { AgentSlice, DemoPayload } from "../../shared/types";
import { formatDay, title } from "../../shared/format";
import { Lock, Sprig } from "./Icons";

interface Props {
  demo: DemoPayload;
  step: number;
}

export function Rail({ demo, step }: Props) {
  const indexOfTone = (tone: string) => demo.transcript.findIndex((message) => message.tone === tone);
  const checked = step > indexOfTone("peer-check");
  const replied = step > indexOfTone("peer-reply");
  const decision = step > indexOfTone("decision");

  return (
    <aside className="rail">
      <span className="eyebrow">The two stores</span>
      <h3 className="rail__title">Private by construction.</h3>
      <p className="rail__lede">
        Each agent holds one owner's records. A peer check returns a fixed projection. Names, doses,
        dates. Never notes.
      </p>

      {demo.slices.map((slice) => (
        <StoreCard key={slice.key} slice={slice} />
      ))}

      <div className={`rail__cross ${replied ? "is-live" : ""}`}>
        <div className="rail__cross-head">
          <span className="label">What crossed</span>
          <span className="rail__cross-state mono">
            {replied ? "complete" : checked ? "reading" : "waiting"}
          </span>
        </div>
        {replied ? (
          <>
            <p className="rail__stat">
              <strong>{demo.shared.reply.active.length}</strong>
              <span>{demo.shared.reply.active.length === 1 ? "medication" : "medications"}</span>
            </p>
            <p className="rail__cross-meta">
              {demo.shared.reply.withheld} notes stayed with Rohan's agent.
            </p>
          </>
        ) : checked ? (
          <p className="rail__cross-meta">Rohan's agent is reading its own store.</p>
        ) : (
          <p className="rail__cross-meta">
            Nothing yet. Neither agent can read the other's records.
          </p>
        )}
      </div>

      <div className={`rail__brief ${decision ? "is-live" : ""}`}>
        <Sprig width={16} height={16} />
        <span>
          {decision
            ? `Brief ready · ${demo.brief.medications.length} medications · ${demo.brief.decisions.length} decision`
            : "Brief waits for a decision"}
        </span>
      </div>

      <p className="rail__foot">
        Counts come from this demo run. Note text never crosses the peer check.
      </p>
    </aside>
  );
}

function StoreCard({ slice }: { slice: AgentSlice }) {
  return (
    <article className={`store store--${slice.color}`}>
      <header className="store__head">
        <span className={`monogram monogram--agent monogram--${slice.color}`}>
          <Sprig width={15} height={15} />
        </span>
        <div className="store__id">
          <span className="store__owner">{slice.owner}</span>
          <span className="store__agent">
            {slice.relation} · {slice.agent}
          </span>
        </div>
        <span className="store__count mono">{String(slice.records).padStart(2, "0")}</span>
      </header>

      <ul className="store__meds">
        {slice.medications.map((med) => (
          <li key={`${med.name}-${med.sourceEventId}`}>
            <span className="store__med-name">
              {title(med.name)} {med.dose ? <em>{med.dose}</em> : null}
            </span>
            <span className="store__med-since">since {formatDay(med.since)}</span>
          </li>
        ))}
      </ul>

      <footer className="store__foot">
        <Lock width={11} height={11} />
        {slice.withheldNotes} {slice.withheldNotes === 1 ? "note stays" : "notes stay"} private
      </footer>
    </article>
  );
}
