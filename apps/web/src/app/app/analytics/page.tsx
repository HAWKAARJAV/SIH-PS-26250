"use client";

import { useEffect, useState } from "react";
import { PageContext, SimulatedLabel } from "@/components/page-context";
import { ErrorState } from "@/components/states";
import { api } from "@/lib/api";

type Card = { trained?: boolean; auc?: number; brier?: number; model?: string; note?: string; message?: string; holdout_rows?: number; seed?: number; simulated?: boolean };
type Monte = { runs: number; valid_runs: number; served_min: number; served_max: number; served_mean: number; note: string; seed: number; simulated?: boolean };
type Bench = { runs?: number; scale?: string; seeds?: number[]; solver_beats_or_ties_greedy?: number; message?: string };

export default function AnalyticsPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [monte, setMonte] = useState<Monte | null>(null);
  const [bench, setBench] = useState("");
  const [cardError, setCardError] = useState("");
  const [benchError, setBenchError] = useState("");
  const [trainError, setTrainError] = useState("");
  const [monteError, setMonteError] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    api<Card>("/api/v1/forecast/serviceability")
      .then(setCard)
      .catch((err: unknown) => setCardError(err instanceof Error ? err.message : "Serviceability did not load."))
      .finally(() => setCardReady(true));
    api<Bench>("/api/v1/benchmark")
      .then((data) => {
        if (!data.runs) {
          setBench(data.message || "Run pnpm benchmark to generate docs/benchmarks/latest.json");
          return;
        }
        setBench(
          `SIMULATED BENCHMARK · scale ${data.scale} · seeds ${data.seeds?.join(", ")} · solver beat/tie greedy ${data.solver_beats_or_ties_greedy}/${data.runs}`,
        );
      })
      .catch((err: unknown) => setBenchError(err instanceof Error ? err.message : "The benchmark did not load."));
  }, []);

  async function train() {
    setTrainError("");
    try {
      setCard(await api<Card>("/api/v1/forecast/serviceability", { method: "POST" }));
      setCardError("");
      setCardReady(true);
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Only an admin can train the card.");
    }
  }

  async function runMonte() {
    setMonteError("");
    try {
      setMonte(await api<Monte>("/api/v1/montecarlo", { method: "POST" }));
    } catch (err) {
      setMonteError(err instanceof Error ? err.message : "The Monte Carlo run did not finish.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Forecasts</h1>
      <PageContext
        purpose="Experimental analytics cards — serviceability model, repository benchmark, and Monte Carlo disruption runs. None of these outputs feed the live planner."
        judgeLine="Every number on this page is labelled SIMULATED and comes from an explicit API call you can repeat."
        actor="Admin trains the serviceability card. Any signed-in role can run Monte Carlo."
        label={<SimulatedLabel />}
        related={[{ href: "/docs", label: "Judge notes" }, { href: "/app/plan", label: "Planner (live path)" }]}
      />
      <article className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Serviceability · SIMULATED</h2>
        {cardError && <ErrorState message={cardError} />}
        {!cardError && card?.trained && (
          <p className="mt-2">SIMULATED holdout. Seed {card.seed}. AUC {card.auc}, Brier {card.brier}, {card.holdout_rows} rows. {card.note}</p>
        )}
        {cardReady && !cardError && !card?.trained && (
          <p className="mt-2">{card?.message || "No model card yet."}</p>
        )}
        {trainError && <ErrorState message={trainError} />}
        <button className="mt-3 rounded-lg border border-line px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={role !== "admin"} onClick={() => void train()}>
          Train serviceability on the seeded fleet — admin
        </button>
        {role !== "" && role !== "admin" && <p className="mt-2 text-xs text-ink-3">An admin trains this card. The button stays closed for your role.</p>}
      </article>
      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Benchmark</h2>
        {benchError && <ErrorState message={benchError} />}
        {bench && <p className="mt-2 font-mono text-sm">{bench}</p>}
      </article>
      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Monte Carlo · SIMULATED</h2>
        {monte && (
          <p className="mt-2">
            SIMULATED. Seed {monte.seed}. {monte.valid_runs} of {monte.runs} runs stayed valid. Missions served {monte.served_min} to {monte.served_max}, mean {monte.served_mean}. {monte.note}
          </p>
        )}
        {monteError && <ErrorState message={monteError} />}
        <button className="mt-3 rounded-lg border border-line px-3 py-2" type="button" onClick={() => void runMonte()}>
          Run 20 simulated disruptions on the small theatre — any signed-in role
        </button>
      </article>
    </section>
  );
}
