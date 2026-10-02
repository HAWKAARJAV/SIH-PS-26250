"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Aircraft = { tail: string; status: string; freshness: string };
type Crew = { id: string; status: string };
type Plan = { id: string; status: string; kpis: { value_weighted_fulfilment?: number; missions_served?: number; missions_total?: number } };

export default function DashboardPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ items: Aircraft[] }>("/api/v1/registers/aircraft"),
      api<{ items: Crew[] }>("/api/v1/registers/crew"),
      api<{ items: Plan[] }>("/api/v1/plans"),
    ])
      .then(([a, c, p]) => {
        setAircraft(a.items);
        setCrew(c.items);
        setPlans(p.items);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The dashboard could not load."));
  }, []);

  const fmc = aircraft.filter((row) => row.status === "FMC").length;
  const ready = crew.filter((row) => row.status === "AVAILABLE").length;
  const fresh = aircraft.filter((row) => row.freshness === "FRESH").length;
  const latest = plans[0];
  const tiles = [
    ["Mission fulfilment", latest?.kpis.value_weighted_fulfilment != null ? `${Math.round(latest.kpis.value_weighted_fulfilment * 1000) / 10}%` : "No plan yet"],
    ["Aircraft mission-capable", aircraft.length ? `${fmc} / ${aircraft.length}` : "…"],
    ["Crew ready", crew.length ? `${ready} / ${crew.length}` : "…"],
    ["Data freshness", aircraft.length ? `${fresh} / ${aircraft.length} fresh` : "…"],
    ["Reserve integrity", latest ? "Held in the plan" : "Set when you optimise"],
  ];

  return (
    <section>
      <h1 className="font-display text-4xl">Command glance</h1>
      {error && <p className="mt-4 text-brick" role="alert">{error}</p>}
      {!aircraft.length && !error && <p className="mt-4 text-ink-3">Counting every serviceable tail…</p>}
      <div className="mt-6 grid gap-3 md:grid-cols-5">
        {tiles.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
            <p className="text-xs uppercase tracking-wide text-ink-3">{label}</p>
            <p className="mt-2 font-mono text-xl text-ink">{value}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <Link className="rounded-lg bg-ember px-4 py-3 text-surface" href="/app/plan">Open the planner</Link>
        <Link className="rounded-lg border border-line-strong px-4 py-3" href="/app/retask">Retask console</Link>
      </div>
    </section>
  );
}
