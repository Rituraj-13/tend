import { useEffect, useRef, useState } from "react";
import type { LiveMessage } from "../../shared/live";
import { formatClock } from "../../shared/format";
import { RichText } from "../components/RichText";
import { Sprig } from "../components/Icons";

const TEND_BLOCK = /```tend\s*([\s\S]*?)```/;

const AGENT_COLOR: Record<string, string> = {
  maya: "sage",
  rohan: "clay",
};

interface Props {
  messages: LiveMessage[];
  roomId: string | null;
}

export function LiveTranscript({ messages, roomId }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const previous = useRef(messages.length);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    const total = messages.length;
    const delta = total - previous.current;
    previous.current = total;

    if (delta < 0) {
      setUnseen(0);
      return;
    }
    if (delta === 0) return;

    if (atBottom) {
      setUnseen(0);
      const element = scroller.current;
      if (element) element.scrollTop = element.scrollHeight;
      return;
    }
    setUnseen((value) => value + delta);
  }, [messages.length, atBottom]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  };

  const jump = () => {
    const element = scroller.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    element.focus({ preventScroll: true });
    setUnseen(0);
  };

  return (
    <section className="live-thread" aria-labelledby="live-thread-title">
      <header className="live-thread__bar">
        <h2 id="live-thread-title" className="live-thread__room mono">
          # {roomId ?? "family-room"}
        </h2>
        <span className="live-thread__count">
          {messages.length === 1 ? "1 message" : `${messages.length} messages`}
        </span>
      </header>

      <div
        className="live-thread__scroll"
        ref={scroller}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Live room transcript"
      >
        {messages.length === 0 ? (
          <p className="live-thread__empty">
            No room messages yet. The transcript appears here as the agents talk.
          </p>
        ) : (
          <ol className="live-thread__list" aria-labelledby="live-thread-title">
            {messages.map((message) => (
              <LiveMessageRow key={message.id} message={message} />
            ))}
          </ol>
        )}
      </div>

      {unseen > 0 ? (
        <button
          type="button"
          className="live-new"
          onClick={jump}
          aria-label={`Jump to ${unseen === 1 ? "1 new message" : `${unseen} new messages`}`}
        >
          {unseen === 1 ? "1 new message" : `${unseen} new messages`}
          <span aria-hidden="true">↓</span>
        </button>
      ) : null}

      <p className="live-thread__note">
        Read-only view of the Switch room. Write in Switch, not here.
      </p>
    </section>
  );
}

function LiveMessageRow({ message }: { message: LiveMessage }) {
  const isHuman = message.senderKind === "human";
  const prose = message.body.replace(TEND_BLOCK, "").trim();
  const color = AGENT_COLOR[message.originKey] ?? "ink";

  return (
    <li className={`msg msg--${message.senderKind} tone--${message.tone} live-msg`}>
      <div className="msg__gutter">
        {isHuman ? (
          <span className="monogram monogram--human">{message.sender.charAt(0)}</span>
        ) : (
          <span className={`monogram monogram--agent monogram--${color}`}>
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
          {!message.confirmed ? (
            <span className="live-msg__pending" title="Switch has not confirmed this message">
              Unconfirmed
            </span>
          ) : null}
          <time className="msg__time" dateTime={message.at}>
            {formatClock(message.at)}
          </time>
        </header>

        <div className="msg__text">
          <RichText text={prose} />
        </div>

        <Payload body={message.body} />
      </article>
    </li>
  );
}

function Payload({ body }: { body: string }) {
  const raw = TEND_BLOCK.exec(body)?.[1];
  if (!raw) return null;

  let pretty = raw;
  let hint = "unparsed";
  try {
    const parsed = JSON.parse(raw) as { type?: string; active?: unknown[]; withheld?: number };
    pretty = JSON.stringify(parsed, null, 2);
    hint =
      parsed.type === "med_check_reply"
        ? `${parsed.type} · ${parsed.active?.length ?? 0} shared · ${parsed.withheld ?? 0} withheld`
        : parsed.type === "med_check"
          ? `${parsed.type} · 1 candidate`
          : (parsed.type ?? "payload");
  } catch {
    hint = "unparsed";
  }

  return (
    <details className="live-payload">
      <summary className="live-payload__summary">
        <span>Structured payload</span>
        <span className="live-payload__hint">{hint}</span>
      </summary>
      <pre className="live-payload__json">{pretty}</pre>
    </details>
  );
}
