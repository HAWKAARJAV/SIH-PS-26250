import Link from "next/link";

const SCENES = [
  "Seven domains, no common picture. Open COP Health.",
  "Baseline ATO in seconds. Open the planner and optimise.",
  "Murphy strikes. Mark a tail NMC on the retask console.",
  "Why. Open a mission the plan did not serve.",
  "Trust. Submit, approve, publish, then verify the audit chain.",
  "Proof. The plan label and the validator are the numbers. Nothing here is typed by hand.",
];

export default function JudgePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl">Judge mode</h1>
      <ol className="mt-6 grid gap-3">
        {SCENES.map((scene, index) => (
          <li key={scene} className="rounded-xl border border-line bg-surface p-4">{index + 1}. {scene}</li>
        ))}
      </ol>
      <Link className="mt-6 inline-block rounded-lg bg-ember px-4 py-3 text-surface" href="/login">Start from sign-in</Link>
    </main>
  );
}
