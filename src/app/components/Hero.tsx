import type { DemoPayload } from "../../shared/types";
import { formatDay, title } from "../../shared/format";
import { Play } from "./Icons";

interface Props {
  demo: DemoPayload;
  onPlay: () => void;
}

export function Hero({ demo, onPlay }: Props) {
  const maya = demo.slices.find((slice) => slice.key === "maya") ?? demo.slices[0];
  const rohan = demo.slices.find((slice) => slice.key === "rohan") ?? demo.slices[1];
  const newMed = maya?.medications.find((med) => med.name === demo.conflict.finding.newMed);
  const oldMed = rohan?.medications.find((med) => med.name === demo.conflict.finding.existingMed);

  return (
    <section className="hero">
      <div className="shell">
        <div className="hero__intro">
          <span className="hero__eyebrow">
            <span className="hero__eyebrow-dot" aria-hidden="true" />
            Private by design
            <span aria-hidden="true">·</span>
            Shared in a room
            <span aria-hidden="true">·</span>
            Signed by a human
          </span>

          <h1 className="hero__title">
            Each agent knows half.
            <span className="hero__title-line">
              The room knows <mark>enough</mark>.
            </span>
          </h1>

          <p className="hero__deck">
            Tend gives each person in the family their own agent and one shared Switch room. The
            agents keep their records private, check each other when a prescription changes, and
            surface the conflict no single person could see.
          </p>

          <div className="hero__actions">
            <button type="button" className="button" onClick={onPlay}>
              <Play className="button__icon" width={11} height={11} />
              Play the room
            </button>
            <a className="button button--ghost" href="#brief">
              Read the brief
              <span className="button__arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          </div>

          <p className="hero__trust mono">
            {demo.transcript.length} messages · {demo.metrics.agents} agents · one room · no model
            call
          </p>
        </div>

        <div className="stage">
          <div className="stage__bar">
            <span className="stage__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="stage__room-name mono"># rao-family</span>
            <span className="stage__tag">
              <span className="stage__live" aria-hidden="true" />
              Switch room
            </span>
          </div>

          <div className="stage__body">
            <article className="store-peek store-peek--maya">
              <header>
                <span className="store-peek__kicker">Private store</span>
                <span className="store-peek__lock">Only Maya's agent can read it</span>
              </header>
              <strong className="store-peek__owner">{maya?.agent ?? "Maya's agent"}</strong>
              <p className="store-peek__med">
                {title(newMed?.name ?? demo.conflict.finding.newMed)}{" "}
                {newMed?.dose ? <em>{newMed.dose}</em> : null}
              </p>
              <p className="store-peek__meta">
                started today · {maya?.records ?? 3} records held
              </p>
              <p className="store-peek__foot">
                {maya?.withheldNotes ?? 1} note stays private
              </p>
            </article>

            <div className="stage__room">
              <span className="stage__room-kicker">The shared surface</span>
              <div className="stage__wires" aria-hidden="true">
                <span>peer check</span>
                <span>redacted reply</span>
              </div>
              <div className="stage__conflict">
                <span className="stage__conflict-label">Possible interaction</span>
                <p className="stage__pair">
                  {title(demo.conflict.finding.newMed)}
                  <span aria-hidden="true">+</span>
                  {title(demo.conflict.finding.existingMed)}
                </p>
                <p className="stage__conflict-note">
                  Raised only because both agents are in one room.
                </p>
              </div>
              <p className="stage__room-foot mono">
                {demo.metrics.owners} owners · {demo.metrics.agents} agents · 1 timeline
              </p>
            </div>

            <article className="store-peek store-peek--rohan">
              <header>
                <span className="store-peek__kicker">Private store</span>
                <span className="store-peek__lock">Only Rohan's agent can read it</span>
              </header>
              <strong className="store-peek__owner">{rohan?.agent ?? "Rohan's agent"}</strong>
              <p className="store-peek__med">
                {title(oldMed?.name ?? demo.conflict.finding.existingMed)}{" "}
                {oldMed?.dose ? <em>{oldMed.dose}</em> : null}
              </p>
              <p className="store-peek__meta">
                since {oldMed ? formatDay(oldMed.since) : "2024"} · {rohan?.records ?? 6} records
                held
              </p>
              <p className="store-peek__foot">
                {rohan?.withheldNotes ?? 4} notes stay private
              </p>
            </article>
          </div>

          <div className="stage__foot mono">
            <span>Maya's store never meets Rohan's store</span>
            <span>The room is the join</span>
          </div>
        </div>

        <div className="signal">
          <div className="signal__lead">
            <span className="signal__kicker">The run</span>
            <strong>One line in. One conflict out.</strong>
          </div>
          <dl className="signal__stats">
            <div>
              <dt>Messages</dt>
              <dd>{demo.transcript.length}</dd>
            </div>
            <div>
              <dt>Private records</dt>
              <dd>{demo.metrics.privateRecords}</dd>
            </div>
            <div>
              <dt>Notes withheld</dt>
              <dd>{demo.metrics.withheld}</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>1</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
