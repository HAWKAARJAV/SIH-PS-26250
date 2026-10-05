"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageContext } from "@/components/page-context";
import { api } from "@/lib/api";

type Why = { reason: string; relaxations: { id: string; label: string; effect: string }[] };
type Risk = { score: number; note: string; model: string; drivers: Record<string, number | boolean> };

const DRIVER_LABELS: Record<string, string> = {
  threat_exposure: "Threat exposure",
  weather_penalty: "Weather penalty",
  fleet_reliability_6h: "Fleet reliability at 6 hours",
  crew_fatigue: "Crew fatigue",
  support_dependency: "Needs tanker support",
};

export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  const [why, setWhy] = useState<Why | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id;
    setLoading(true);
    setError("");
    Promise.all([
      api<Why>(`/api/v1/missions/${id}/why-not`),
      api<Risk>(`/api/v1/missions/${id}/risk`),
    ])
      .then(([reason, score]) => {
        setWhy(reason);
        setRisk(score);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "That mission did not load."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const relaxations = why?.relaxations ?? [];
  const drivers = risk ? Object.entries(risk.drivers ?? {}) : [];

  return (
    <section>
      <h1 className="font-mono text-3xl">{params.id}</h1>
      <PageContext
        purpose="Server-generated explanation for why this mission is scheduled or left off the active plan, plus a heuristic risk score from seeded drivers."
        judgeLine="Relaxations list what would have to change for the optimiser to include this mission."
        actor="Read-only for all roles. Mission data changes on the missions register or via import."
        related={[{ href: "/app/missions", label: "Missions register" }, { href: "/app/plan", label: "Planner" }]}
      >
        <Link className="text-sm text-vyom underline decoration-vyom/40" href="/app/missions">← Back to missions</Link>
      </PageContext>
      {loading && <p className="mt-3 text-sm text-ink-3" role="status">Loading the explanation…</p>}
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}

      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Why this, or why not</h2>
        <p className="mt-1 text-sm text-ink-3">The plain-language reason this mission sits where it does, plus relaxations that would change the answer.</p>
        {!loading && !error && !why && (
          <p className="mt-3 text-sm text-ink-2">No why-not text for this mission.</p>
        )}
        {why && (
          <>
            <p className="mt-2">{why.reason || "The explainer returned no reason for this mission."}</p>
            {relaxations.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">No relaxation would put this mission on the plan.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {relaxations.map((row) => (
                  <li key={row.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{row.label}. {row.effect}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {!loading && error && !why && (
          <p className="mt-3 text-sm text-ink-2">No why-not text for this mission.</p>
        )}
      </article>

      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Risk</h2>
        <p className="mt-1 text-sm text-ink-3">A weighted score from the seeded picture. It is not a calibrated probability.</p>
        {!loading && !risk && (
          <p className="mt-3 text-sm text-ink-2">No risk score for this mission.</p>
        )}
        {risk && (
          <>
            <p className="mt-2">Score {risk.score}.</p>
            <p className="text-sm text-ink-3">{risk.note || "No note with this score."} Model {risk.model || "unknown"}.</p>
            {drivers.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">No risk drivers were returned.</p>
            ) : (
              <ul className="mt-3 grid gap-1 text-sm">
                {drivers.map(([key, value]) => (
                  <li key={key}>{DRIVER_LABELS[key] || key}: {String(value)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </article>
    </section>
  );
}
