"use client";

import Link from "next/link";
import { useState } from "react";

const SCENES = [
  { title: "Seven domains", href: "/app/fusion", note: "Open COP Health. An admin can degrade a feed." },
  { title: "Baseline ATO", href: "/app/plan", note: "Sign in as the ops planner and press Optimise." },
  { title: "Murphy strikes", href: "/app/retask", note: "Inject weather at Bravo, a closed base, or an aircraft NMC." },
  { title: "Why", href: "/app/plan", note: "Open a mission that is not on the plan. The page states why." },
  { title: "Trust", href: "/app/ato", note: "Submit as the planner. Approve and publish as the commander." },
  { title: "Proof", href: "/app/audit", note: "The auditor verifies the hash chain. Benchmark numbers come from pnpm benchmark." },
];

export default function JudgePage() {
  const [index, setIndex] = useState(0);
  const scene = SCENES[index];
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl">Judge mode</h1>
      <p className="mt-2 font-mono text-sm text-ink-3">Scene {index + 1} of {SCENES.length}</p>
      <article className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">{scene.title}</h2>
        <p className="mt-2">{scene.note}</p>
        <Link className="mt-4 inline-block rounded-lg bg-ember px-4 py-3 text-surface" href={scene.href}>Open this step</Link>
      </article>
      <div className="mt-4 flex gap-2">
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>Back</button>
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((value) => Math.min(SCENES.length - 1, value + 1))}>Next</button>
      </div>
    </main>
  );
}
