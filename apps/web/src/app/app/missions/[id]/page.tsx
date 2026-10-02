"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Why = { reason: string; relaxations: { id: string; label: string; effect: string }[] };
type Risk = { score: number; note: string; model: string; drivers: Record<string, number | boolean> };

export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  const [why, setWhy] = useState<Why | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    Promise.all([
      api<Why>(`/api/v1/missions/${id}/why-not`),
      api<Risk>(`/api/v1/missions/${id}/risk`),
    ])
      .then(([reason, score]) => {
        setWhy(reason);
        setRisk(score);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "That mission did not load."));
  }, [params.id]);

  return (
    <section>
      <h1 className="font-mono text-3xl">{params.id}</h1>
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      {!why && !error && <p className="mt-3 text-ink-3">Asking why this mission sits where it does…</p>}
      {why && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">Why this, or why not</h2>
          <p className="mt-2">{why.reason}</p>
          <ul className="mt-3 grid gap-2">
            {why.relaxations.map((row) => (
              <li key={row.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{row.label}. {row.effect}</li>
            ))}
          </ul>
        </article>
      )}
      {risk && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">Risk {risk.score}</h2>
          <p className="text-sm text-ink-3">{risk.note} Model {risk.model}.</p>
        </article>
      )}
    </section>
  );
}
