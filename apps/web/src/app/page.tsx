"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { team } from "@/config/team";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

const BARS = [
  { id: "ADP", label: "ADP patrol", start: 8, span: 18, lane: 0 },
  { id: "ISR", label: "ISR", start: 22, span: 24, lane: 1 },
  { id: "AAR", label: "AAR", start: 30, span: 20, lane: 2 },
  { id: "SAR", label: "SAR", start: 48, span: 14, lane: 3 },
];

const linkClass =
  "inline-flex cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink underline decoration-ink-3 underline-offset-4 hover:bg-surface-2";
const primaryClass =
  "inline-flex cursor-pointer items-center rounded-lg bg-ember px-4 py-3 text-sm font-medium text-surface hover:bg-ember-hover";

export default function HomePage() {
  const [impact, setImpact] = useState("");
  const [benchState, setBenchState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [benchError, setBenchError] = useState("The benchmark file could not be read.");
  const [struck, setStruck] = useState(false);

  useEffect(() => {
    fetch("/api/v1/benchmark")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
          runs?: number;
          solver_beats_or_ties_greedy?: number;
          scale?: string;
          seeds?: number[];
        };
        if (!response.ok) throw new Error(data.message || "The benchmark file could not be read.");
        return data;
      })
      .then((data) => {
        if (!data.runs) {
          setBenchState("empty");
          return;
        }
        setImpact(
          `Simulated benchmark only. At scale ${data.scale}, seeds ${data.seeds?.join(", ")}, the solver beat or tied greedy in ${data.solver_beats_or_ties_greedy} of ${data.runs} runs.`,
        );
        setBenchState("ready");
      })
      .catch((err: unknown) => {
        setBenchError(err instanceof Error ? err.message : "The benchmark file could not be read.");
        setBenchState("error");
      });
  }, []);

  const bars = useMemo(
    () =>
      BARS.map((bar) =>
        struck && bar.id === "ADP" ? { ...bar, start: 40, label: "ADP moved later" } : bar,
      ),
    [struck],
  );

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <p className="rounded-full bg-ember-tint px-3 py-1 text-center text-xs tracking-wide text-ember">{brand.disclaimer}</p>
      <header className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="font-display text-2xl">{brand.name}</p>
        <nav className="flex flex-wrap gap-2" aria-label="Landing page">
          <a className={linkClass} href="#how">Jump to how a day is replanned</a>
          <Link className={linkClass} href="/docs">Open glossary and architecture notes</Link>
          <Link className={linkClass} href="/login">Sign in to the live demo</Link>
        </nav>
      </header>
      <section className="mt-16 grid gap-10 md:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="text-sm text-ink-3">{brand.tagline}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">
            VYUHA proposes a new flying plan when the day changes, and a person has to approve it.
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">
            Judges see one picture of aircraft, crew, stores, airspace, weather, threats and tasking for the fictional theatre MERIDIAN. The software offers a few courses of action. It does not launch anything.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className={primaryClass} href="/login">Sign in and open the live demo</Link>
            <Link className={linkClass} href="/app/judge">Open the 3-minute tour for judges</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>Mini tasking board — illustration, not a live plan</span>
            <button
              className="cursor-pointer rounded-lg border border-ember bg-ember px-3 py-2 text-sm font-medium text-surface hover:bg-ember-hover"
              type="button"
              onClick={() => setStruck(true)}
            >
              Murphy strikes — illustration only
            </button>
          </div>
          <div className="relative h-40" aria-hidden="true">
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
          <p className="mt-2 text-sm text-ink-2">
            {struck
              ? "Illustration only. The ADP patrol bar moved later on this sketch so it clears the closure. No aircraft was retasked and no plan was saved."
              : "Nothing has moved yet. The button only slides the ADP bar on this sketch."}
          </p>
        </div>
      </section>
      <section id="how" className="mt-20 grid gap-4 md:grid-cols-4">
        <h2 className="sr-only">How a flying day is replanned</h2>
        {["Fuse", "Plan", "Retask", "Decide"].map((step, index) => (
          <article key={step} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-mono text-ink-3">0{index + 1}</p>
            <h3 className="mt-2 font-display text-2xl">{step}</h3>
            <p className="mt-2 text-sm text-ink-2">
              {step === "Fuse" && "Eight feeds become one picture, and each value keeps its age and source."}
              {step === "Plan" && "A baseline air tasking order is built, then an independent checker must also call it valid."}
              {step === "Retask" && "A small part of the day moves. The rest of the schedule stays put."}
              {step === "Decide" && "Ranked options, a deadline, and a named person on the approval."}
            </p>
          </article>
        ))}
      </section>
      <section className="mt-16">
        <h2 className="font-display text-3xl">Seven domains, one picture</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {["Aircraft", "Crew", "Stores", "Airspace", "Weather", "Threats", "Tasking", "Execution feedback"].map((name) => (
            <li key={name} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">{name}</li>
          ))}
        </ul>
      </section>
      <section className="mt-16" aria-live="polite">
        <h2 className="font-display text-3xl">Simulated benchmark</h2>
        {benchState === "loading" && <LoadingState label="Reading the benchmark file…" />}
        {benchState === "error" && <ErrorState message={benchError} />}
        {benchState === "empty" && <EmptyState title="No benchmark runs published" detail="The file came back with no runs, so this line stays blank." />}
        {benchState === "ready" && <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">{impact}</p>}
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
