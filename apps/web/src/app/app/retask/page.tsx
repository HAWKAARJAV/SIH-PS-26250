"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Coa = { id: string; name: string; recommended: boolean; rationale: string; changes: number; metrics: { missions_served?: number; value_weighted_fulfilment?: number } };
type Aircraft = { tail: string; status: string };

export default function RetaskPage() {
  const [tails, setTails] = useState<Aircraft[]>([]);
  const [tail, setTail] = useState("");
  const [coas, setCoas] = useState<Coa[]>([]);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api<{ items: Aircraft[] }>("/api/v1/registers/aircraft").then((data) => {
      const fmc = data.items.filter((row) => row.status === "FMC");
      setTails(fmc);
      setTail(fmc[0]?.tail ?? "");
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Fleet did not load."));
  }, []);

  async function inject() {
    setError("");
    setNote("Asking the neighbourhood to move…");
    try {
      const result = await api<{ event_id: string; coas: Coa[] }>("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({ type: "AIRCRAFT_NMC", severity: "WARNING", payload: { tail } }),
      });
      setEventId(result.event_id);
      setCoas(result.coas);
      setNote(`${result.coas.length} courses of action.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The event did not inject.");
    }
  }

  async function select(id: string) {
    try {
      const result = await api<{ plan_id: string }>(`/api/v1/coas/${eventId}-${id}/select`, {
        method: "POST",
        body: JSON.stringify({ reason: "Selected from the console." }),
      });
      setNote(`Created ${result.plan_id} and sent it for approval.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Selection needs a commander.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Retask</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">Tail
          <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={tail} onChange={(e) => setTail(e.target.value)}>
            {tails.slice(0, 40).map((row) => <option key={row.tail}>{row.tail}</option>)}
          </select>
        </label>
        <button className="rounded-lg bg-ember px-4 py-3 text-surface" type="button" onClick={() => void inject()}>Mark NMC and replan</button>
      </div>
      {note && <p className="mt-3 text-sm text-ink-2">{note}</p>}
      {error && <p className="mt-3 text-sm text-brick" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {coas.map((coa) => (
          <article key={coa.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{coa.id} · {coa.name}</h2>
              {coa.recommended && <span className="rounded-full bg-moss-tint px-2 py-1 text-xs text-moss">Recommended</span>}
            </div>
            <p className="mt-2 text-sm text-ink-2">{coa.rationale}</p>
            <p className="mt-2 font-mono text-sm">{coa.changes} changes · {coa.metrics.missions_served} served</p>
            <button className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-sm" type="button" onClick={() => void select(coa.id)}>Select and request approval</button>
          </article>
        ))}
      </div>
    </section>
  );
}
