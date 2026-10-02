import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl">VYUHA notes</h1>
      <p className="mt-4 text-ink-2">A planning and logistics decision-support prototype. Synthetic theatre MERIDIAN. A human approves every published plan.</p>
      <ul className="mt-6 list-disc pl-5 text-ink-2">
        <li>ATO is the air tasking order. ACO is the airspace control order.</li>
        <li>DTG is the date-time group, written as 051430Z OCT 26.</li>
        <li>FMC, PMC and NMC are full, partial and non-mission capable.</li>
        <li>A COA is a course of action. The system proposes. People decide.</li>
      </ul>
      <p className="mt-6"><Link className="text-vyom" href="/api/docs">API reference</Link> · <Link className="text-vyom" href="/">Home</Link></p>
    </main>
  );
}
