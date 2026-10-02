"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { team } from "@/config/team";

const BARS = [
  { id: "ADP", label: "ADP", start: 8, span: 18, lane: 0 },
  { id: "ISR", label: "ISR", start: 22, span: 24, lane: 1 },
  { id: "AAR", label: "AAR", start: 30, span: 20, lane: 2 },
  { id: "SAR", label: "SAR", start: 48, span: 14, lane: 3 },
];

export default function HomePage() {
  const [struck, setStruck] = useState(false);
  const bars = useMemo(
    () =>
      BARS.map((bar) =>
        struck && bar.id === "ADP" ? { ...bar, start: 40, label: "ADP moved" } : bar,
      ),
    [struck],
  );
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <p className="rounded-full bg-ember-tint px-3 py-1 text-center text-xs tracking-wide text-ember">{brand.disclaimer}</p>
      <header className="mt-8 flex items-center justify-between">
        <p className="font-display text-2xl">{brand.name}</p>
        <nav className="flex gap-4 text-sm">
          <a href="#how">How it works</a>
          <Link href="/docs">Docs</Link>
          <Link href="/login">Launch live demo</Link>
        </nav>
      </header>
      <section className="mt-16 grid gap-10 md:grid-cols-[1.1fr_.9fr]">
        <div>
          <h1 className="font-display text-5xl leading-tight text-ink">{brand.tagline}</h1>
          <p className="mt-4 max-w-xl text-ink-2">
            One fused picture of aircraft, crew, stores, airspace, weather, threats and tasking.
            When the day changes, VYUHA offers a few explainable courses of action. A person approves.
          </p>
          <div className="mt-6 flex gap-3">
            <Link className="rounded-lg bg-ember px-4 py-3 text-surface" href="/login">Launch live demo</Link>
            <Link className="rounded-lg border border-line-strong px-4 py-3" href="/app/judge">Take the 3-minute tour</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Mini tasking board</span>
            <button className="rounded-full bg-ember-tint px-3 py-1 text-ember" type="button" onClick={() => setStruck(true)}>
              Murphy strikes
            </button>
          </div>
          <div className="relative h-40">
            {bars.map((bar) => (
              <div
                key={bar.id}
                className="absolute h-7 rounded-md bg-vyom-tint px-2 text-xs leading-7 text-vyom transition-all duration-300"
                style={{ left: `${bar.start}%`, width: `${bar.span}%`, top: bar.lane * 36 }}
              >
                {bar.label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">{struck ? "The patrol slid clear of the closure. Nothing launched itself." : "A quiet hour. The button only moves this sketch."}</p>
        </div>
      </section>
      <section id="how" className="mt-20 grid gap-4 md:grid-cols-4">
        {["Fuse", "Plan", "Retask", "Decide"].map((step, index) => (
          <article key={step} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-mono text-ink-3">0{index + 1}</p>
            <h2 className="mt-2 font-display text-2xl">{step}</h2>
            <p className="mt-2 text-sm text-ink-2">
              {step === "Fuse" && "Eight feeds, one value, with the age and the source still attached."}
              {step === "Plan" && "A baseline ATO that an independent checker must also call valid."}
              {step === "Retask" && "A small neighbourhood moves. The rest of the day stays put."}
              {step === "Decide" && "Ranked options, a deadline, and a name on the approval."}
            </p>
          </article>
        ))}
      </section>
      {team.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-3xl">Team</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {team.map((person) => (
              <li key={person.name} className="rounded-xl border border-line p-4">{person.name} · {person.role}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="mt-20 border-t border-line pt-6 text-sm text-ink-3">
        <p>{brand.disclaimer}</p>
        <p className="mt-2">Planning support only. No weapon effects, no autonomous tasking, no claim of accreditation.</p>
      </footer>
    </main>
  );
}
