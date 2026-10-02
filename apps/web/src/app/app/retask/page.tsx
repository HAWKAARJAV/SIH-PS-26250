"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Coa = {
  id: string;
  coa_id?: string;
  name: string;
  recommended: boolean;
  rationale: string;
  changes: number;
  metrics: { missions_served?: number; value_weighted_fulfilment?: number };
};

const KINDS = [
  ["AIRCRAFT_NMC", "Aircraft NMC"],
  ["WEATHER_UPDATE", "Weather at Bravo"],
  ["BASE_STATUS", "Close Bravo"],
] as const;

type Aircraft = { tail: string; status: string };

export default function RetaskPage() {
  const [tails, setTails] = useState<Aircraft[]>([]);
  const [tail, setTail] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("AIRCRAFT_NMC");
  const [coas, setCoas] = useState<Coa[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [stability, setStability] = useState(50);

  useEffect(() => {
    api<{ items: Aircraft[] }>("/api/v1/registers/aircraft").then((data) => {
      const fmc = data.items.filter((row) => row.status === "FMC");
      setTails(fmc);
      setTail(fmc[0]?.tail ?? "");
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Fleet did not load."));
    api<{ event: { id: string } | null; coas: Coa[] }>("/api/v1/events/latest")
      .then((data) => {
        if (data.event) setEventId(data.event.id);
        setCoas(data.coas);
      })
      .catch(() => setCoas([]));
  }, []);

  function payload() {
    if (kind === "WEATHER_UPDATE") return { base_id: "BASE-BRAVO", ceiling_ft: 400, vis_m: 800 };
    if (kind === "BASE_STATUS") return { base_id: "BASE-BRAVO", status: "CLOSED" };
    return { tail };
  }

  async function inject() {
    setError("");
    setNote("Asking the neighbourhood to move…");
    try {
      const result = await api<{ event_id: string; coas: Coa[] }>("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({ type: kind, severity: "WARNING", payload: payload() }),
      });
      setEventId(result.event_id);
      setCoas(result.coas);
      setNote(`${result.coas.length} courses of action.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The event did not inject.");
    }
  }

  async function select(coa: Coa) {
    try {
      const result = await api<{ plan_id: string }>(`/api/v1/coas/${coa.coa_id ?? `${eventId}-${coa.id}`}/select`, {
        method: "POST",
        body: JSON.stringify({ reason: "Selected from the console." }),
      });
      setNote(`Created ${result.plan_id} and sent it for approval.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Selection needs a commander.");
    }
  }

  const ranked = useMemo(() => {
    return [...coas].sort((a, b) => score(b, stability) - score(a, stability));
  }, [coas, stability]);

  return (
    <section>
      <h1 className="font-display text-4xl">Retask</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">Tail
          <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={tail} onChange={(e) => setTail(e.target.value)}>
            {tails.slice(0, 40).map((row) => <option key={row.tail}>{row.tail}</option>)}
          </select>
        </label>
        <label className="text-sm">Event
          <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {KINDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-ember px-4 py-3 text-surface" type="button" onClick={() => void inject()}>Inject and replan</button>
      </div>
      <label className="mt-4 block text-sm">Prefer fewer changes ({stability})
        <input className="mt-1 block w-64" type="range" min={0} max={100} value={stability} onChange={(e) => setStability(Number(e.target.value))} />
      </label>
      {note && <p className="mt-3 text-sm text-ink-2">{note}</p>}
      {error && <p className="mt-3 text-sm text-brick" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {ranked.map((coa) => (
          <article key={coa.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{coa.id} · {coa.name}</h2>
              {coa.recommended && <span className="rounded-full bg-moss-tint px-2 py-1 text-xs text-moss">Recommended</span>}
            </div>
            <p className="mt-2 text-sm text-ink-2">{coa.rationale}</p>
            <p className="mt-2 font-mono text-sm">{coa.changes} changes · {coa.metrics.missions_served} served</p>
            <button className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-sm" type="button" onClick={() => void select(coa)}>Select and request approval</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function score(coa: Coa, stability: number) {
  const value = coa.metrics.value_weighted_fulfilment ?? 0;
  return value * (100 - stability) - coa.changes * stability;
}
