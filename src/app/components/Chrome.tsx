import type { DemoPayload } from "../../shared/types";
import { ArrowRight, Mark } from "./Icons";

export function Masthead({ onPlay }: { onPlay: () => void }) {
  return (
    <>
      <div className="announce">
        <div className="shell announce__inner">
          <span className="announce__dot" aria-hidden="true" />
          <span className="announce__strong">Flip the Switch 2026</span>
          <span className="announce__text">
            Best Personal &amp; Creative Workflow
          </span>
          <a className="announce__link" href="#room">
            See the room
            <ArrowRight width={12} height={12} />
          </a>
        </div>
      </div>

      <header className="masthead">
        <div className="shell masthead__inner">
          <a className="wordmark" href="#top" aria-label="Tend, back to top">
            <Mark width={22} height={22} />
            <span>Tend</span>
          </a>

          <nav className="masthead__nav" aria-label="Sections">
            <a href="#room">The room</a>
            <a href="#brief">The brief</a>
            <a href="/live">Live room</a>
          </nav>

          <div className="masthead__actions">
            <span className="masthead__badge">
              <span className="masthead__dot" aria-hidden="true" />
              Demo · offline
            </span>
            <button
              type="button"
              className="button button--sm"
              onClick={onPlay}
            >
              Play the room
              <ArrowRight className="button__icon" width={12} height={12} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer({ demo }: { demo: DemoPayload }) {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="wordmark wordmark--small">
              <Mark width={20} height={20} />
              <span>Tend</span>
            </span>
            <p>
              A care room for families. Each person keeps their record. The room
              is where the records finally meet.
            </p>
          </div>

          <div className="footer__col">
            <span className="footer__label">Built with</span>
            <p>Switch agent protocol</p>
            <p>React and TypeScript</p>
            <p>An offline golden path</p>
          </div>

          <div className="footer__col">
            <span className="footer__label">Read</span>
            <a href="#room">The room</a>
            <a href="#brief">The brief</a>
            <a href="#switch">How it works</a>
          </div>
        </div>

        <div className="footer__bottom">
          <p>
            Demo rule pack · {demo.pack.pairs} pairs · v{demo.pack.version}
          </p>
          <p>Not a medical device. Not medical advice. A clinician decides.</p>
          <p className="mono">
            {demo.scenario.room} · {demo.transcript.length} messages ·{" "}
            {demo.metrics.privateRecords} private records
          </p>
        </div>
      </div>
    </footer>
  );
}
