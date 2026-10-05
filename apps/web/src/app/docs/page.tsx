import Link from "next/link";

const linkClass =
  "inline-flex cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink underline decoration-ink-3 underline-offset-4 hover:bg-surface-2";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl">VYUHA notes for judges</h1>
      <p className="mt-4 text-ink-2">
        A planning and logistics decision-support prototype for the fictional theatre MERIDIAN. A human approves every published plan.
      </p>
      <p className="mt-2 rounded-lg bg-ember-tint px-3 py-2 text-sm text-ember">
        All theatre data is SYNTHETIC / SIMULATED. Numbers on dashboards and registers come from the API for the loaded scenario — not from live operations.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl">What the prototype does</h2>
        <p className="mt-3 text-ink-2">
          Eight simulated feeds become one picture. An optimiser proposes a schedule. When the day breaks, it offers a few courses of action. Nothing is published until a named person approves it.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Glossary</h2>
        <dl className="mt-3 grid gap-3 text-ink-2">
          <div>
            <dt className="font-medium text-ink">ATO and ACO</dt>
            <dd>ATO is the air tasking order. ACO is the airspace control order.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">DTG</dt>
            <dd>Date-time group, written as 051430Z OCT 26.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">FMC, PMC and NMC</dt>
            <dd>Full, partial and non-mission capable. An NMC aircraft cannot be tasked.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">COA</dt>
            <dd>A course of action. The system proposes. People decide.</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Who does what</h2>
        <ul className="mt-3 list-disc pl-5 text-ink-2">
          <li>The Ops Planner optimises the day and submits a plan.</li>
          <li>The Commander approves and publishes.</li>
          <li>The Auditor co-signs and checks the audit chain.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">How the pieces connect</h2>
        <p className="mt-3 text-ink-2">
          The browser talks to the API on the same origin. Scenario data lives in the database. Fusion builds one snapshot. The optimiser and a separate validator both read that snapshot. Publish is refused when the validator fails or the required approvals are missing.
        </p>
      </section>

      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Docs links">
        <Link className={linkClass} href="/api/docs">Open the API reference</Link>
        <Link className={linkClass} href="/">Back to the landing page</Link>
        <Link className={linkClass} href="/login">Sign in to the live demo</Link>
      </nav>
    </main>
  );
}
