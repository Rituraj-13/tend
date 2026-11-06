import { useMemo, useState } from "react";
import type { ChatMessage, Conflict, DemoPayload } from "../../shared/types";
import { formatClock, formatDay, formatMoment, title } from "../../shared/format";
import { ArrowDown, Check, PlusMinus, Sprig } from "./Icons";
import { RichText } from "./RichText";

const TEND_BLOCK = /```tend\s*([\s\S]*?)```/;

interface Props {
  message: ChatMessage;
  demo: DemoPayload;
  visible: boolean;
  index: number;
}

export function Message({ message, demo, visible, index }: Props) {
  const isHuman = message.senderKind === "human";
  const isConflict = message.id === demo.conflict.messageId;
  const isDecisionCard = message.senderKind === "agent" && message.tone === "decision";
  const isHandover = message.tone === "handover";
  const prose = message.body.replace(TEND_BLOCK, "").trim();
  const slice = demo.slices.find(
    (entry) => entry.agent === message.sender || entry.owner === message.sender,
  );

  return (
    <li
      className={[
        "msg",
        `msg--${message.senderKind}`,
        `tone--${message.tone}`,
        visible ? "is-visible" : "is-sealed",
      ].join(" ")}
      data-index={index}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="msg__gutter">
        {isHuman ? (
          <span className="monogram monogram--human">{message.sender.charAt(0)}</span>
        ) : (
          <span className={`monogram monogram--agent monogram--${slice?.color ?? "ink"}`}>
            <Sprig width={17} height={17} />
          </span>
        )}
      </div>

      <article className="msg__body">
        <header className="msg__meta">
          <span className="msg__name">{message.sender}</span>
          {message.target ? (
            <span className="msg__target">
              <span aria-hidden="true">→</span> {message.target}
            </span>
          ) : null}
          <time className="msg__time" dateTime={message.at}>
            {formatClock(message.at)}
          </time>
        </header>

        {isConflict ? (
          <ConflictCard demo={demo} conflict={demo.conflict} />
        ) : isDecisionCard ? (
          <DecisionCard demo={demo} />
        ) : isHandover ? (
          <div className="handover">
            <p className="handover__line">
              <RichText text={prose} />
            </p>
            <a className="handover__link" href="#brief">
              Read the care brief <ArrowDown width={13} height={13} />
            </a>
          </div>
        ) : (
          <div className="msg__text">
            <RichText text={prose} />
          </div>
        )}

        {message.tone === "peer-check" || message.tone === "peer-reply" ? (
          <PeerPayload body={message.body} direction={message.tone} />
        ) : null}
      </article>
    </li>
  );
}

function ConflictCard({ demo, conflict }: { demo: DemoPayload; conflict: Conflict }) {
  const raised = demo.slices.find((slice) => slice.agent === conflict.raisedBy);
  const other = demo.slices.find((slice) => slice.agent !== conflict.raisedBy);
  const newMed = raised?.medications.find((med) => med.name === conflict.finding.newMed);
  const oldMed = other?.medications.find((med) => med.name === conflict.finding.existingMed);

  return (
    <div className="conflict">
      <header className="conflict__head">
        <span className="conflict__state">Possible interaction</span>
        <span className="conflict__severity">Needs a human · {conflict.finding.severity}</span>
      </header>

      <div className="conflict__pair">
        <div className="conflict__med">
          <span className="conflict__name">
            {title(conflict.finding.newMed)}
            {newMed?.dose ? <em>{newMed.dose}</em> : null}
          </span>
          <span className="conflict__origin">
            Started {newMed ? formatDay(newMed.since) : "today"} · {raised?.owner}'s record
          </span>
        </div>
        <div className="conflict__join" aria-hidden="true">
          <span>with</span>
        </div>
        <div className="conflict__med">
          <span className="conflict__name">
            {title(conflict.finding.existingMed)}
            {oldMed?.dose ? <em>{oldMed.dose}</em> : null}
          </span>
          <span className="conflict__origin">
            Since {oldMed ? formatDay(oldMed.since) : "unknown"} · {other?.owner}'s record
          </span>
        </div>
      </div>

      <p className="conflict__reason">{conflict.finding.reason}</p>

      <div className="conflict__ask">
        <span className="label">What I need</span>
        <p>
          {raised?.owner}, confirm with the prescriber before the next dose. {other?.owner}, ask the
          pharmacy to check it too.
        </p>
      </div>

      <footer className="conflict__foot">
        <span>Source · demo rule pack. Not medical advice.</span>
        <span className="mono">Conflict {conflict.id}</span>
      </footer>
    </div>
  );
}

function DecisionCard({ demo }: { demo: DemoPayload }) {
  const decision = demo.decision;
  return (
    <div className="decision">
      <header className="decision__head">
        <span className="decision__check">
          <Check width={13} height={13} />
        </span>
        <span className="decision__state">Decision recorded</span>
        <span className="pill pill--resolved">{demo.conflict.state}</span>
      </header>
      <p className="decision__text">{title(decision.text)}</p>
      <dl className="decision__meta">
        <div>
          <dt>Approved by</dt>
          <dd>{decision.approvedBy}</dd>
        </div>
        <div>
          <dt>At</dt>
          <dd>{formatMoment(decision.at)}</dd>
        </div>
        <div>
          <dt>Message</dt>
          <dd className="mono">{decision.messageId}</dd>
        </div>
        <div>
          <dt>Conflict</dt>
          <dd className="mono">{decision.conflictId}</dd>
        </div>
      </dl>
    </div>
  );
}

function PeerPayload({
  body,
  direction,
}: {
  body: string;
  direction: "peer-check" | "peer-reply";
}) {
  const [open, setOpen] = useState(false);
  const payload = useMemo(() => {
    const raw = TEND_BLOCK.exec(body)?.[1];
    if (!raw) return { pretty: "", hint: "empty" };
    try {
      const parsed = JSON.parse(raw) as {
        type?: string;
        active?: unknown[];
        withheld?: number;
      };
      const hint =
        direction === "peer-reply"
          ? `${parsed.type ?? "reply"} · ${parsed.active?.length ?? 0} shared · ${
              parsed.withheld ?? 0
            } withheld`
          : `${parsed.type ?? "request"} · 1 candidate`;
      return { pretty: JSON.stringify(parsed, null, 2), hint };
    } catch {
      return { pretty: raw, hint: "unparsed" };
    }
  }, [body, direction]);

  return (
    <div className={`payload ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="payload__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="payload__label">Structured payload</span>
        <span className="payload__hint">{payload.hint}</span>
        <span className="payload__icon">
          <PlusMinus open={open} />
        </span>
      </button>
      {open ? <pre className="payload__json">{payload.pretty}</pre> : null}
    </div>
  );
}
