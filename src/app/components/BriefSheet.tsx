import type { DemoPayload } from "../../shared/types";
import { count, formatDay, formatMoment, title } from "../../shared/format";

export function BriefSheet({ demo }: { demo: DemoPayload }) {
  const brief = demo.brief;
  const open = brief.conflicts.filter((conflict) => conflict.state === "open").length;
  const summary = [
    `${count(brief.medications.length, "medication")} on file across ${count(
      brief.audit.owners,
      "owner",
    )}.`,
    `${count(brief.decisions.length, "decision")} recorded.`,
    open ? `${count(open, "possible interaction")} still open.` : "No possible interaction is open.",
  ].join(" ");

  const audit = `Built from ${count(brief.audit.ownRecords, "record")} held by ${
    demo.slices[0]?.owner ?? "this owner"
  }, ${count(brief.audit.peerRecords, "record")} shared by another agent, and ${count(
    brief.decisions.length,
    "decision",
  )}. ${count(brief.audit.withheld, "note")} stayed private.`;

  return (
    <section className="brief-section" id="brief">
      <div className="shell">
        <header className="section-head section-head--split">
          <div className="section-head__left">
            <span className="section-head__index">02 / The brief</span>
            <div>
              <h2 className="section-head__title">One page the next appointment inherits.</h2>
              <p className="section-head__note">
                Generated from both stores after the decision, not written by hand. Print it, hand
                it to the doctor, and the last two weeks fit on one page.
              </p>
            </div>
          </div>
          <button type="button" className="button button--ghost no-print" onClick={() => window.print()}>
            Print this page
          </button>
        </header>

        <article className="sheet" id="brief-sheet">
          <div className="sheet__top">
            <span className="sheet__brand">Tend · Care brief</span>
            <span className="sheet__stamp mono">{formatMoment(brief.generatedAt)}</span>
          </div>

          <h3 className="sheet__name">{brief.person}</h3>
          <p className="sheet__sub">
            For the next appointment, the next sibling on duty, or the next caregiver.
          </p>
          <p className="sheet__lede">{summary}</p>

          <section className="sheet__section">
            <h4 className="sheet__label">Medications</h4>
            <table className="sheet__table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dose</th>
                  <th>Since</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {brief.medications.map((med) => (
                  <tr key={`${med.name}-${med.recordedBy}-${med.since}`}>
                    <td data-label="Medicine">
                      {title(med.name)}
                      {med.shared ? <span className="sheet__tag">shared</span> : null}
                    </td>
                    <td data-label="Dose">{med.dose || "Not recorded"}</td>
                    <td data-label="Since">{formatDay(med.since)}</td>
                    <td data-label="Recorded by">{med.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="sheet__section">
            <h4 className="sheet__label">Decision</h4>
            {brief.decisions.map((decision) => (
              <div className="sheet__decision" key={decision.id}>
                <p className="sheet__decision-text">{title(decision.text)}</p>
                <p className="sheet__byline">
                  {decision.approvedBy} · {formatMoment(decision.at)} · message{" "}
                  <span className="mono">{decision.messageId}</span> · conflict{" "}
                  <span className="mono">{decision.conflictId}</span>
                </p>
              </div>
            ))}
          </section>

          <section className="sheet__section">
            <h4 className="sheet__label">Questions for the prescriber</h4>
            <ol className="sheet__questions">
              {brief.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </section>

          <div className="sheet__warning">
            <span className="sheet__warning-label">Read this first</span>
            <p>{brief.disclaimer}</p>
          </div>

          <footer className="sheet__foot">
            <p>{audit}</p>
            <span className="mono">1 / 1</span>
          </footer>
        </article>

        <p className="brief-section__cap no-print">
          The brief is generated from the two private stores after the decision, not written by hand.
          The full document is in your browser, ready for A4 or Letter.
        </p>
      </div>
    </section>
  );
}
