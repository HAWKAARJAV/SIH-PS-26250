"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Glance = {
  decision_state: string;
  decision_required: boolean;
  validation: { valid: boolean; violations: { message: string }[] };
  kpis: {
    mission_fulfilment: number | null;
    p1_coverage: number | null;
    aircraft_fmc: string;
    crew_ready: string;
    data_freshness: string;
    reserve_integrity: string;
  };
  plan: { id: string; status: string } | null;
  impact: { summary?: string; decision_deadline?: string; t_minus_min?: number } | null;
  coa_count: number;
};

export default function DashboardPage() {
  const [glance, setGlance] = useState<Glance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError("");
    api<Glance>("/api/v1/command/glance")
      .then(setGlance)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The dashboard could not load."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const fulfil =
    glance?.kpis.mission_fulfilment != null ? `${Math.round(glance.kpis.mission_fulfilment * 1000) / 10}%` : "No plan yet";
  const p1 =
    glance?.kpis.p1_coverage != null ? `${Math.round(glance.kpis.p1_coverage * 1000) / 10}%` : "—";
  const planValid = glance?.validation.valid ? "PASS · 0 hard violations" : "Not valid — open planner";
  const tiles = [
    ["Mission fulfilment", fulfil],
    ["P1 coverage", p1],
    ["Aircraft FMC", glance?.kpis.aircraft_fmc ?? "…"],
    ["Crew ready", glance?.kpis.crew_ready ?? "…"],
    ["Data freshness", glance?.kpis.data_freshness ?? "…"],
    ["Plan validator", planValid],
    ["Reserve integrity", glance?.kpis.reserve_integrity ?? "…"],
    ["Plan status", glance?.plan ? `${glance.plan.id} · ${glance.plan.status}` : "No plan"],
  ];

  return (
    <section>
      <h1 className="font-display text-4xl">Command glance</h1>
      <p className="mt-2 font-mono text-sm text-ink-3">Answers in five seconds — all numbers from the live snapshot.</p>
      {loading && <LoadingState label="Loading the command snapshot…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && !glance && <EmptyState title="No snapshot yet" detail="The command glance returned nothing." />}
      {glance && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${glance.decision_required ? "border-brick bg-brick-tint" : "border-moss bg-moss-tint"}`}
        >
          <p className="flex flex-wrap items-center gap-2 font-display text-lg">
            {glance.decision_state}
            <StatusBadge tone={glance.decision_required ? "bad" : "ok"}>
              {glance.decision_required ? "Decision required" : "Holding"}
            </StatusBadge>
          </p>
          {glance.decision_required && glance.impact?.summary && (
            <p className="mt-1 text-sm text-ink-2">
              {glance.impact.summary}
              {glance.coa_count > 0 ? ` · ${glance.coa_count} COAs ready` : ""}
            </p>
          )}
          {glance.decision_required && (
            <Link className="mt-2 inline-block text-sm font-medium text-ember underline" href="/app/retask">
              Open retask console →
            </Link>
          )}
        </div>
      )}
      {glance && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
            <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
            <p className="mt-2 font-mono text-lg text-ink">{value}</p>
            {label === "Plan validator" && (
              <StatusBadge tone={glance.validation.valid ? "ok" : "warn"}>{glance.validation.valid ? "PASS" : "Check"}</StatusBadge>
            )}
            {label === "Plan status" && glance.plan && <StatusBadge tone="info">{glance.plan.status}</StatusBadge>}
          </article>
        ))}
      </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="rounded-lg bg-ember px-4 py-3 text-surface" href="/app/plan">Open planner</Link>
        <Link className="rounded-lg border border-line-strong px-4 py-3" href="/app/retask">Retask console</Link>
        <Link className="rounded-lg border border-line-strong px-4 py-3" href="/app/judge">Judge mode</Link>
      </div>
    </section>
  );
}
