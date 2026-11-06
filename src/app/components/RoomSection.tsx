import { useEffect, useRef } from "react";
import type { DemoPayload } from "../../shared/types";
import { Message } from "./Message";
import { Rail } from "./Rail";
import type { Replay } from "../useReplay";
import { slug } from "../../shared/format";
import { Pause, Play } from "./Icons";

interface Props {
  demo: DemoPayload;
  replay: Replay;
}

export function RoomSection({ demo, replay }: Props) {
  const threadRef = useRef<HTMLOListElement>(null);
  const activeBeat = demo.beats.reduce((active, beat, index) => {
    const start = demo.transcript.findIndex((message) => message.beat === beat.key);
    return start >= 0 && start < replay.step ? index : active;
  }, 0);
  const progress = demo.beats.length > 1 ? (activeBeat / (demo.beats.length - 1)) * 100 : 0;
  const beat = demo.beats[activeBeat];

  useEffect(() => {
    if (!replay.playing) return;
    const node = threadRef.current?.querySelector<HTMLElement>(
      `[data-index="${replay.step - 1}"]`,
    );
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [replay.step, replay.playing]);

  const jumpToBeat = (key: string) => {
    const index = demo.transcript.findIndex((message) => message.beat === key);
    if (index >= 0) replay.jump(index + 1);
  };

  return (
    <section className="room" id="room" tabIndex={-1} aria-labelledby="room-title">
      <div className="shell">
        <header className="section-head">
          <span className="section-head__index">01 / The room</span>
          <div>
            <h2 className="section-head__title" id="room-title">
              One thread. Two private stores.
            </h2>
            <p className="section-head__note">
              The peer check in full, including the typed payload the agents actually exchanged.
              Play it, or step through message by message.
            </p>
          </div>
        </header>

        <div className="room__grid">
          <div className="room__main">
            <div className="room-card">
              <div className="room-card__bar">
                <span className="room-card__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="room-card__title mono"># {slug(demo.scenario.room)}</span>
                <span className="room-card__badge">
                  <span aria-hidden="true" />
                  {demo.metrics.agents} agents · live
                </span>
              </div>

              <div className="player">
              <div className="player__top">
                <button
                  type="button"
                  className="player__play"
                  onClick={replay.toggle}
                  aria-label={replay.playing ? "Pause the replay" : "Play the replay"}
                >
                  {replay.playing ? (
                    <Pause width={14} height={14} />
                  ) : (
                    <Play width={14} height={14} />
                  )}
                </button>

                <div className="player__now" role="status" aria-live="polite" aria-atomic="true">
                  <span className="player__state">
                    {replay.playing ? "Playing the room" : replay.done ? "Replay the room" : "Paused"}
                  </span>
                  <span className="player__beat">{beat?.label ?? "The room"}</span>
                </div>

                <div className="player__controls">
                  <button type="button" onClick={replay.prev} aria-label="Previous message">
                    ←
                  </button>
                  <span className="mono">
                    {String(replay.step).padStart(2, "0")} / {String(replay.total).padStart(2, "0")}
                  </span>
                  <button type="button" onClick={replay.next} aria-label="Next message">
                    →
                  </button>
                </div>
              </div>

              <div className="timeline">
                <div className="timeline__rail" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <ol className="timeline__beats">
                  {demo.beats.map((item, index) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={[
                          "timeline__dot",
                          index <= activeBeat ? "is-done" : "",
                          index === activeBeat ? "is-active" : "",
                        ].join(" ")}
                        onClick={() => jumpToBeat(item.key)}
                        aria-label={`Jump to: ${item.label}`}
                        aria-current={index === activeBeat ? "step" : undefined}
                        title={`${item.label} · ${item.note}`}
                      />
                    </li>
                  ))}
                </ol>
              </div>

              <p className="player__note">{beat?.note}</p>
            </div>

            <ol className="thread" ref={threadRef}>
              {demo.transcript.map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  demo={demo}
                  index={index}
                  visible={index < replay.step}
                />
              ))}
            </ol>

            <p className="thread__end">
              End of the record. The bottom line is a brief a doctor can read in ten seconds.
            </p>
            </div>
          </div>

          <Rail demo={demo} step={replay.step} />
        </div>
      </div>
    </section>
  );
}
