"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { api } from "@/lib/api";

const STEPS = [
  { title: "Reset demo", action: "reset" as const, note: "Load S5 compound Murphy · seed 26250 · scale M." },
  { title: "Baseline plan", href: "/app/plan", note: "Planner → Optimise. Validator must show PASS." },
  { title: "COP health", href: "/app/fusion", note: "Fresh and stale feeds; conflict inbox." },
  { title: "Murphy event", href: "/app/retask", note: "Close Bravo + T-114 NMC (or use inject on retask)." },
  { title: "Command glance", href: "/app", note: "COMMAND DECISION REQUIRED banner." },
  { title: "Approve & publish", href: "/app/ato", note: "Planner submit → commander approve → auditor co-sign → publish." },
  { title: "Audit", href: "/app/audit", note: "Auditor → Verify chain PASS." },
];

export default function JudgePage() {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scene = STEPS[index];

  async function resetDemo() {
    setError("");
    setStatus("");
    setLoading(true);
    try {
      await api("/api/v1/scenarios/load", {
        method: "POST",
        body: JSON.stringify({ pack: "S5", seed: 26250, scale: "M" }),
      });
      setStatus("Scenario S5 loaded. Continue with baseline optimise.");
      setIndex(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Judge mode</h1>
      <p className="mt-2 text-sm text-ink-3">Scripted tour · deterministic seed 26250 · SYNTHETIC DATA</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg bg-ember px-4 py-3 text-surface" type="button" onClick={() => void resetDemo()}>
          RESET DEMO
        </button>
        <button className="rounded-lg border border-line-strong px-4 py-3" type="button" onClick={() => setIndex(0)}>
          START 3-MINUTE TOUR
        </button>
      </div>
      {loading && <LoadingState label="Loading judge scenario S5…" />}
      {error && <ErrorState message={error} onRetry={() => void resetDemo()} />}
      {!loading && !error && !status && (
        <p className="mt-3 text-sm text-ink-3" role="status">No scenario has been loaded in this tour yet.</p>
      )}
      {status && <p className="mt-3 text-sm text-ink-2">{status}</p>}
      <p className="mt-4 font-mono text-sm text-ink-3">Step {index + 1} of {STEPS.length}</p>
      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">{scene.title}</h2>
        <p className="mt-2">{scene.note}</p>
        {scene.action === "reset" ? (
          <button className="mt-4 rounded-lg border border-line-strong px-4 py-3" type="button" onClick={() => void resetDemo()}>
            Run reset
          </button>
        ) : (
          <Link className="mt-4 inline-block rounded-lg bg-ember px-4 py-3 text-surface" href={scene.href!}>
            Open step
          </Link>
        )}
      </article>
      <div className="mt-4 flex gap-2">
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((v) => Math.max(0, v - 1))}>Back</button>
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((v) => Math.min(STEPS.length - 1, v + 1))}>Next</button>
      </div>
    </section>
  );
}
