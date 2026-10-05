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

const STEPS = [
  { id: "Fuse", copy: "Eight feeds become one picture, and each value keeps its age and source." },
  { id: "Plan", copy: "A baseline air tasking order is built, then an independent checker must also call it valid." },
  { id: "Retask", copy: "A small part of the day moves. The rest of the schedule stays put." },
  { id: "Decide", copy: "Ranked options, a deadline, and a named person on the approval." },
];

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
    <div className="min-h-screen">
      <p className="bg-ink px-4 py-1.5 text-center text-[11px] tracking-[0.16em] text-canvas">{brand.disclaimer}</p>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <p className="font-display text-2xl">{brand.name}</p>
        <nav className="flex items-center gap-2" aria-label="Landing page">
          <a className="hidden rounded-full px-3 py-2 text-sm text-ink-2 hover:bg-surface sm:inline-flex" href="#how">
            How a day is replanned
          </a>
          <Link className="rounded-full px-3 py-2 text-sm text-ink-2 hover:bg-surface" href="/docs">
            Notes
          </Link>
          <Link className="rounded-full bg-ember px-4 py-2 text-sm font-medium text-surface hover:bg-ember-hover" href="/login">
            Sign in
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="pt-8 md:pt-12">
          <div className="max-w-3xl">
            <p className="text-sm tracking-wide text-ember">{brand.tagline}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">
              A new flying plan, when the day changes.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-2">
              One picture of aircraft, crew, stores, airspace, weather, threats and tasking for the fictional theatre MERIDIAN. The software offers courses of action. A person approves them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-full bg-ember px-5 py-3 text-sm font-medium text-surface hover:bg-ember-hover" href="/login">
                Sign in and open the live demo
              </Link>
              <Link className="rounded-full border border-line-strong bg-surface px-5 py-3 text-sm text-ink hover:bg-surface-2" href="/app/judge">
                Open the 3-minute tour for judges
              </Link>
            </div>
          </div>
          <div className="mt-10 rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-2)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-ink-3">Illustration</p>
                <p className="mt-1 text-sm text-ink">Mini tasking board — not a live plan</p>
              </div>
              <button
                className="rounded-full bg-ember px-4 py-2 text-sm font-medium text-surface hover:bg-ember-hover"
                type="button"
                onClick={() => setStruck(true)}
              >
                Murphy strikes — illustration only
              </button>
            </div>
            <div className="relative h-44 rounded-xl bg-canvas px-2 py-3" aria-hidden="true">
              {bars.map((bar) => (
                <div
                  key={bar.id}
                  className="absolute flex h-8 items-center rounded-md bg-vyom px-2 text-xs text-surface shadow-[var(--shadow-1)]"
                  style={{ left: `calc(${bar.start}% + 4px)`, width: `${bar.span}%`, top: 12 + bar.lane * 40 }}
                >
                  {bar.label}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-2">
              {struck
                ? "Illustration only. The ADP patrol bar moved later on this sketch so it clears the closure. No aircraft was retasked and no plan was saved."
                : "Nothing has moved yet. The button only slides the ADP bar on this sketch."}
            </p>
          </div>
        </section>

        <section id="how" className="mt-16">
          <h2 className="font-display text-3xl">How a flying day is replanned</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <article key={step.id} className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-1)]">
                <p className="font-mono text-xs text-ember">0{index + 1}</p>
                <h3 className="mt-3 font-display text-2xl">{step.id}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-2">{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl">Seven domains, one picture</h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {["Aircraft", "Crew", "Stores", "Airspace", "Weather", "Threats", "Tasking", "Execution feedback"].map((name) => (
              <li key={name} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2">
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20" aria-live="polite">
          <h2 className="font-display text-3xl">Simulated benchmark</h2>
          {benchState === "loading" && <LoadingState label="Reading the benchmark file…" />}
          {benchState === "error" && <ErrorState message={benchError} />}
          {benchState === "empty" && <EmptyState title="No benchmark runs published" detail="The file came back with no runs, so this line stays blank." />}
          {benchState === "ready" && (
            <p className="mt-5 max-w-3xl rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 shadow-[var(--shadow-1)]">{impact}</p>
          )}
        </section>

        {team.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display text-3xl">Team</h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {team.map((person) => (
                <li key={person.name} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-medium">{person.name}</p>
                  <p className="mt-1 text-sm text-ink-3">{person.role}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="border-t border-line px-6 py-8 text-sm text-ink-3">
        <div className="mx-auto max-w-6xl">
          <p>{brand.disclaimer}</p>
          <p className="mt-2">Planning support only. No weapon effects, no autonomous tasking, no claim of accreditation.</p>
        </div>
      </footer>
    </div>
  );
}
