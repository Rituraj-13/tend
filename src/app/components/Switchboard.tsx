import { useMemo, useState } from "react";
import type { DemoPayload } from "../../shared/types";
import {
  buildBoard,
  type ConflictEntry,
  type Power,
  type RoomView,
  type SwitchView,
  type TerminalView,
  type ThreadEntry,
  type WireLoomView,
} from "../switchboard-model";

const CLAIMS = [
  {
    title: "A shared surface",
    body: "Two agents, two owners, one timeline. The conflict exists because both agents are in the same room.",
  },
  {
    title: "Addressing rules",
    body: "An agent answers its own owner. A sibling cannot instruct it, and it cannot answer for its owner.",
  },
  {
    title: "A witness",
    body: "The approval is a room message from a named person. The decision keeps the message id that approved it.",
  },
];

const POLES = [0, 1, 2] as const;

export function Switchboard({ demo }: { demo: DemoPayload }) {
  const [power, setPower] = useState<Power>("off");
  const board = useMemo(() => buildBoard(demo, power), [demo, power]);
  const toggle = () => setPower((current) => (current === "off" ? "on" : "off"));

  return (
    <section
      className="switchboard"
      id="switch"
      data-power={board.power}
      aria-labelledby="switchboard-title"
    >
      <div className="shell">
        <header className="section-head switchboard__head">
          <span className="section-head__index">03 / How it works</span>
          <div>
            <h2 className="section-head__title" id="switchboard-title">
              Remove the room and the record splits again.
            </h2>
            <p className="section-head__note">
              The product is a room, not a dashboard. Switch supplies the parts that make two
              private stores safe to put in one place.
            </p>
          </div>
        </header>

        <div className="switchboard__statement">
          <h3>Neither agent could see it alone.</h3>
          <p>
            Maya's agent could not see the warfarin record. Rohan's agent did not know about the new
            prescription. Flip the switch to put both agents in the room, and the interaction becomes
            visible.
          </p>
        </div>

        <div className="sb-board" data-power={board.power}>
          <WireLoom wires={board.wires} />
          <div className="sb-board__grid">
            <div className="sb-terminals">
              {board.terminals.map((terminal) => (
                <TerminalCard key={terminal.id} view={terminal} />
              ))}
            </div>

            <div className="sb-link sb-link--in" aria-hidden="true">
              <span>{board.wires.tag}</span>
            </div>

            <div className="sb-stage">
              <PowerSwitch view={board.switch} onToggle={toggle} />
            </div>

            <div className="sb-link sb-link--out" aria-hidden="true">
              <span>{board.wires.tag}</span>
            </div>

            <RoomPanel view={board.room} />
          </div>
        </div>

        <WireLegend wires={board.wires} />

        <p className="switchboard__live" role="status" aria-live="polite" aria-atomic="true">
          {board.switch.announcement}
        </p>

        <ul className="claims">
          {CLAIMS.map((claim, index) => (
            <li key={claim.title}>
              <span className="claims__index mono">{String(index + 1).padStart(2, "0")}</span>
              <h4>{claim.title}</h4>
              <p>{claim.body}</p>
            </li>
          ))}
        </ul>

        <div className="switchboard__foot">
          <p>
            The replay above runs offline so the story is reproducible. The same policy speaks the
            Switch agent protocol through <code>server/switch/client.ts</code>, so two real agents can
            run the same path in a hosted room.
          </p>
          <p className="switchboard__warn">
            Tend surfaces a possible interaction and stops. It does not diagnose, dose, or advise. The
            interaction pack is a demo rule set, not a clinical database.
          </p>
        </div>
      </div>
    </section>
  );
}

function WireLoom({ wires }: { wires: WireLoomView }) {
  const wireClass = `sb-wire sb-wire--${wires.state}`;
  return (
    <svg
      className="sb-wires"
      viewBox="0 0 1194 632"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 
        3 input wires from the 3 terminal cards (x=261):
        - Top card (maya): y=105 -> converges smoothly to switch (x=336, y=316)
        - Middle card (rohan): y=316 -> straight horizontal line directly into switch (x=336, y=316)
        - Bottom card (host): y=527 -> converges smoothly to switch (x=336, y=316)
      */}
      <path className={`${wireClass} sb-wire--maya`} d="M 261 105 C 300 105, 305 316, 336 316" />
      <path className={`${wireClass} sb-wire--rohan`} d="M 261 316 L 336 316" />
      <path className={`${wireClass} sb-wire--host`} d="M 261 527 C 300 527, 305 316, 336 316" />

      {/* 
        Output wire from the right side of the switch (x=396, y=316) directly into the room (x=471, y=316):
        - Single straight horizontal connection into the room
      */}
      <path className={`${wireClass} sb-wire--room`} d="M 396 316 L 471 316" />
    </svg>
  );
}

function TerminalCard({ view }: { view: TerminalView }) {
  return (
    <article className={`sb-terminal sb-terminal--${view.tone}`}>
      <div className="sb-terminal__bar">
        <span className="sb-terminal__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="sb-terminal__signal">{view.signal}</span>
      </div>
      <h3 className="sb-terminal__title">{view.title}</h3>
      <p className="sb-terminal__subtitle">{view.subtitle}</p>
      <p className="sb-terminal__meta">{view.meta}</p>
      <p className="sb-terminal__line">{view.mono}</p>
      <div className={`sb-gap sb-gap--${view.gap.state}`}>
        <span className="sb-gap__label">{view.gap.label}</span>
        <span className="sb-gap__fact">{view.gap.fact}</span>
        <span className="sb-gap__id">{view.gap.id}</span>
      </div>
    </article>
  );
}

function PowerSwitch({ view, onToggle }: { view: SwitchView; onToggle: () => void }) {
  return (
    <div className="sb-power">
      <button
        type="button"
        role="switch"
        aria-checked={view.checked}
        aria-label="Family room power"
        aria-describedby="sb-power-hint"
        className="sb-toggle-btn"
        onClick={onToggle}
      >
        <span className="sb-toggle-btn__track">
          <span className="sb-toggle-btn__thumb" />
        </span>
      </button>

      <span className="sb-power__sublabel mono" aria-hidden="true">
        {view.checked ? "SWITCH ON" : "SWITCH OFF"}
      </span>

      <p className="sb-switch__status" id="sb-power-hint">
        {view.hint}
      </p>
    </div>
  );
}

function WireLegend({ wires }: { wires: WireLoomView }) {
  return (
    <div className="sb-legend">
      <span className="sb-legend__title">Wires</span>
      <ul className="sb-legend__items">
        {wires.items.map((wire) => (
          <li className="sb-legend__item" key={wire.id}>
            <span className={`sb-legend__line sb-legend__line--${wire.state}`} aria-hidden="true" />
            {wire.label}
          </li>
        ))}
      </ul>
      <span className="sb-legend__state">
        {wires.state === "closed" ? "Circuit closed" : "Circuit open"}
      </span>
    </div>
  );
}

function RoomPanel({ view }: { view: RoomView }) {
  return (
    <section className="sb-room" data-state={view.state} aria-labelledby="sb-room-title">
      <div className="sb-room__bar">
        <span className="sb-room__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h3 className="sb-room__name mono" id="sb-room-title">
          {view.title}
        </h3>
        <span className={`sb-room__chip sb-room__chip--${view.state}`}>{view.chip}</span>
      </div>

      <div className="sb-room__body">
        <div className="sb-members">
          <span className="sb-col-label">Members</span>
          <ul className="sb-members__list">
            {view.members.map((member) => (
              <li className={`sb-member sb-member--${member.tone}`} key={member.id}>
                <span className="sb-member__avatar" aria-hidden="true">
                  {member.initials}
                </span>
                <div className="sb-member__body">
                  <span className="sb-member__name">{member.name}</span>
                  <span className="sb-member__relation">{member.relation}</span>
                  <span className="sb-member__agent">{member.agent}</span>
                  <span className="sb-member__tags">
                    <span className="sb-agent-tag">{member.tag}</span>
                    <span className="sb-member__state">{member.state}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="sb-thread">
          <div className="sb-thread__head">
            <span className="sb-col-label">Thread</span>
            <span className="sb-thread__count">{view.count}</span>
          </div>

          {view.empty ? (
            <div className="sb-locked">
              <span className="sb-locked__mark" aria-hidden="true">
                Off
              </span>
              <strong>{view.empty.title}</strong>
              <p>{view.empty.body}</p>
            </div>
          ) : (
            <>
              <ol className="sb-thread__list">
                {view.thread.map((entry) => (
                  <ThreadRow key={entry.id} entry={entry} />
                ))}
              </ol>
              {view.moreHref ? (
                <a className="sb-thread__more" href={view.moreHref}>
                  Full thread ↓
                </a>
              ) : null}
            </>
          )}
        </div>

        <RoomSidebar view={view} />
      </div>
    </section>
  );
}

function RoomSidebar({ view }: { view: RoomView }) {
  return (
    <div className="sb-side">
      <span className="sb-col-label">Room</span>
      <dl className="sb-side__list">
        {view.sidebar.map((row) => (
          <div className="sb-side__row" key={row.key}>
            <dt>{row.label}</dt>
            <dd className="sb-side__value">{row.value}</dd>
            <dd className="sb-side__detail">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ThreadRow({ entry }: { entry: ThreadEntry }) {
  if (entry.kind === "human") {
    return (
      <li className="sb-msg">
        <span className="sb-msg__avatar" aria-hidden="true">
          {entry.sender.charAt(0)}
        </span>
        <div className="sb-msg__body">
          <span className="sb-msg__meta">
            <strong>{entry.sender}</strong>
            <span>{entry.meta}</span>
          </span>
          <p className="sb-msg__text">{entry.body}</p>
        </div>
      </li>
    );
  }

  if (entry.kind === "protocol") {
    return (
      <li className="sb-proto">
        <span className="sb-proto__flow">{entry.direction}</span>
        <span className="sb-proto__label">{entry.label}</span>
        <span className="sb-proto__detail">{entry.detail}</span>
      </li>
    );
  }

  if (entry.kind === "conflict") {
    return <ConflictRow entry={entry} />;
  }

  return (
    <li className="sb-decision">
      <span className="sb-decision__check" aria-hidden="true">
        ✓
      </span>
      <div>
        <p className="sb-decision__text">{entry.text}</p>
        <p className="sb-decision__meta">
          {entry.approvedBy} · {entry.decisionId} · {entry.meta}
        </p>
      </div>
    </li>
  );
}

function ConflictRow({ entry }: { entry: ConflictEntry }) {
  return (
    <li className="sb-conflict">
      <div className="sb-conflict__head">
        <span className="sb-conflict__label">{entry.label}</span>
        <span className="sb-conflict__severity">{entry.severity}</span>
      </div>
      <p className="sb-conflict__pair">
        <strong>{entry.newMed}</strong>
        <span>{entry.newDose}</span>
        <span aria-hidden="true">+</span>
        <strong>{entry.existingMed}</strong>
        <span>{entry.existingDose}</span>
      </p>
      <p className="sb-conflict__reason">{entry.reason}</p>
      <p className="sb-conflict__meta">
        {entry.raisedBy} · {entry.meta} · {entry.newId} · {entry.existingId}
      </p>
    </li>
  );
}
