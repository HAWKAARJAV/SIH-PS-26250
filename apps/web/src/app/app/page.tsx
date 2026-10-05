"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
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
    glance?.kpis.p1_coverage != null ? `${Math.round(glance.kpis.p1_coverage * 1000) / 10}%` : "No plan yet";
  const planValid = !glance?.plan
    ? "No plan yet"
    : glance.validation.valid
      ? "PASS · 0 hard violations"
      : glance.validation.violations[0]?.message || "Not valid — open the planner";
  const tiles: { label: string; value: string; meaning: string }[] = [
    {
      label: "Mission fulfilment",
      value: fulfil,
      meaning: "Value-weighted share of missions covered by the plan on this glance.",
    },
    {
      label: "P1 coverage",
      value: p1,
      meaning: "Share of priority-1 missions covered by that same plan.",
    },
    {
      label: "Aircraft FMC",
      value: glance?.kpis.aircraft_fmc ?? "…",
      meaning: "Fully mission-capable aircraft, ready out of the fleet on the snapshot.",
    },
    {
      label: "Crew ready",
      value: glance?.kpis.crew_ready ?? "…",
      meaning: "Crew marked available, out of the roster on the snapshot.",
    },
    {
      label: "Data freshness",
      value: glance?.kpis.data_freshness ?? "…",
      meaning: "Aircraft whose snapshot row is marked fresh, out of the fleet.",
    },
    {
      label: "Plan validator",
      value: planValid,
      meaning: !glance?.plan
        ? "Nothing to check until an ops planner presses Optimise the flying day."
        : glance.validation.valid
          ? "Hard-rule check on this plan. Pass means no hard violations."
          : "Hard-rule check on this plan. Next: open the planner and press Check this plan.",
    },
    {
      label: "Reserve integrity",
      value: glance?.kpis.reserve_integrity ?? "…",
      meaning: "Whether the held reserve still passes the same plan validator.",
    },
    {
      label: "Plan status",
      value: glance?.plan ? `${glance.plan.id} · ${glance.plan.status}` : "No plan",
      meaning: glance?.plan ? "Plan id and status this glance is reading." : "No plan is loaded on this glance yet.",
    },
  ];

  return (
    <section>
      <h1 className="font-display text-4xl">Command glance</h1>
      <PageContext
        purpose="A single read-only snapshot of plan health, resources, and whether a commander decision is waiting. Every KPI below is computed from the same API response as the decision banner."
        judgeLine="Point to the decision banner first, then the KPI tiles — all numbers trace to /api/v1/command/glance, not hand-entered."
        actor="Everyone reads this screen. Only the Ops Planner optimises and only the Commander selects a COA after disruption."
        related={[
          { href: "/app/plan", label: "Planner" },
          { href: "/app/retask", label: "Retask" },
          { href: "/app/ato", label: "ATO lifecycle" },
        ]}
      />
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
              {glance.coa_count > 0 ? ` · ${glance.coa_count} courses of action on the server` : ""}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-2">
            {glance.decision_required
              ? "Next: open the retask console, read the blast radius, and select a course of action. That creates a draft for the commander."
              : "Next: open the planner. An ops planner presses Optimise the flying day, then Check this plan, then Submit for commander approval."}
          </p>
          <Link
            className="mt-3 inline-flex cursor-pointer rounded-lg bg-ember px-4 py-3 text-sm font-medium text-surface hover:bg-ember-hover"
            href={glance.decision_required ? "/app/retask" : "/app/plan"}
          >
            {glance.decision_required ? "Open retask console" : "Open planner"}
          </Link>
        </div>
      )}
      {glance && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <article key={tile.label} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
            <p className="text-xs uppercase tracking-wide text-ink-3">{tile.label}</p>
            <p className="mt-2 font-mono text-lg text-ink">{tile.value}</p>
            <p className="mt-2 text-sm text-ink-2">{tile.meaning}</p>
            {tile.label === "Plan validator" && (
              <StatusBadge tone={!glance.plan ? "neutral" : glance.validation.valid ? "ok" : "warn"}>
                {!glance.plan ? "No plan" : glance.validation.valid ? "PASS" : "Check"}
              </StatusBadge>
            )}
            {tile.label === "Plan status" && glance.plan && <StatusBadge tone="info">{glance.plan.status}</StatusBadge>}
          </article>
        ))}
      </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="inline-flex cursor-pointer flex-col rounded-lg bg-ember px-4 py-3 text-sm font-medium text-surface hover:bg-ember-hover" href="/app/plan">
          Open planner
          <span className="mt-1 text-xs font-normal">Destination: planner</span>
        </Link>
        <Link className="inline-flex cursor-pointer flex-col rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-2" href="/app/retask">
          Retask console
          <span className="mt-1 text-xs font-normal text-ink-2">Destination: retask</span>
        </Link>
        <Link className="inline-flex cursor-pointer flex-col rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-2" href="/app/judge">
          Judge mode
          <span className="mt-1 text-xs font-normal text-ink-2">Destination: judge</span>
        </Link>
      </div>
    </section>
  );
}
