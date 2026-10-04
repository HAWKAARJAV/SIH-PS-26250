"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Card = { trained?: boolean; auc?: number; brier?: number; model?: string; note?: string; message?: string; holdout_rows?: number };
type Monte = { runs: number; valid_runs: number; served_min: number; served_max: number; served_mean: number; note: string; seed: number };

export default function AnalyticsPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [monte, setMonte] = useState<Monte | null>(null);
  const [bench, setBench] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<Card>("/api/v1/forecast/serviceability").then(setCard).catch(() => setCard(null));
    api<{ runs?: number; scale?: string; seeds?: number[]; solver_beats_or_ties_greedy?: number }>("/api/v1/benchmark")
      .then((data) => {
        if (!data.runs) {
          setBench("Run pnpm benchmark to generate docs/benchmarks/latest.json");
          return;
        }
        setBench(
          `SIMULATED BENCHMARK · scale ${data.scale} · seeds ${data.seeds?.join(", ")} · solver beat/tie greedy ${data.solver_beats_or_ties_greedy}/${data.runs}`,
        );
      })
      .catch(() => setBench(""));
  }, []);

  async function train() {
    setError("");
    try {
      setCard(await api<Card>("/api/v1/forecast/serviceability", { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Only an admin can train the card.");
    }
  }

  async function runMonte() {
    setError("");
    try {
      setMonte(await api<Monte>("/api/v1/montecarlo", { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Monte Carlo run did not finish.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Forecasts</h1>
      <p className="mt-2 text-sm text-ink-3">Every number below is computed. Simulated data.</p>
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      <article className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Serviceability</h2>
        {card?.trained ? (
          <p className="mt-2">Holdout AUC {card.auc}, Brier {card.brier}, {card.holdout_rows} rows. {card.note}</p>
        ) : (
          <p className="mt-2">{card?.message || "No model card yet."}</p>
        )}
        <button className="mt-3 rounded-lg border border-line px-3 py-2" type="button" onClick={() => void train()}>Train on the seeded fleet</button>
      </article>
      {bench && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">Benchmark</h2>
          <p className="mt-2 font-mono text-sm">{bench}</p>
        </article>
      )}
      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Monte Carlo</h2>
        {monte && <p className="mt-2">Seed {monte.seed}. {monte.valid_runs} of {monte.runs} runs stayed valid. Missions served {monte.served_min} to {monte.served_max}, mean {monte.served_mean}. {monte.note}</p>}
        <button className="mt-3 rounded-lg border border-line px-3 py-2" type="button" onClick={() => void runMonte()}>Run 20 disruptions</button>
      </article>
    </section>
  );
}
