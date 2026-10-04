"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Coa = {
  id: string;
  coa_id?: string;
  name: string;
  recommended: boolean;
  rationale: string;
  changes: number;
  matrix_score?: number;
  metrics: {
    missions_served?: number;
    value_weighted_fulfilment?: number;
    stability_score?: number;
    hard_violations?: number;
  };
  validation?: { valid: boolean };
  diff?: { kind: string; mission_id: string }[];
};

type Impact = {
  summary: string;
  affected_missions: string[];
  decision_deadline?: string;
  t_minus_min?: number;
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
  const [impact, setImpact] = useState<Impact | null>(null);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [valueW, setValueW] = useState(40);
  const [stabW, setStabW] = useState(50);
  const [riskW, setRiskW] = useState(30);
  const [reserveW, setReserveW] = useState(40);
  const coasRef = useRef<Coa[]>([]);
  coasRef.current = coas;

  const rerank = useCallback(async (list: Coa[]) => {
    if (!list.length) return;
    const ranked = await api<{ items: Coa[] }>("/api/v1/coas/rank", {
      method: "POST",
      body: JSON.stringify({ value: valueW, stability: stabW, risk: riskW, reserve: reserveW, coas: list }),
    });
    setCoas(ranked.items);
  }, [valueW, stabW, riskW, reserveW]);

  useEffect(() => {
    let pending = 2;
    function done() {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    }
    api<{ items: Aircraft[] }>("/api/v1/registers/aircraft").then((data) => {
      const fmc = data.items.filter((row) => row.status === "FMC");
      setTails(fmc);
      setTail(fmc.find((row) => row.tail === "TAIL-114")?.tail ?? fmc[0]?.tail ?? "");
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Fleet did not load.")).finally(done);
    api<{ event: { id: string } | null; coas: Coa[] }>("/api/v1/events/latest")
      .then((data) => {
        if (data.event) setEventId(data.event.id);
        if (data.coas.length) setCoas(data.coas);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The last event did not load."))
      .finally(done);
  }, []);

  useEffect(() => {
    if (!coasRef.current.length) return;
    const handle = window.setTimeout(() => {
      void rerank(coasRef.current);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [valueW, stabW, riskW, reserveW, rerank]);

  function payload() {
    if (kind === "WEATHER_UPDATE") return { base_id: "BASE-BRAVO", ceiling_ft: 400, vis_m: 800 };
    if (kind === "BASE_STATUS") return { base_id: "BASE-BRAVO", status: "CLOSED" };
    return { tail };
  }

  async function inject() {
    setError("");
    setBusy(true);
    setNote("Impact analysis → parallel COA solve (SIMULATED · SEED 26250)…");
    try {
      const result = await api<{ event_id: string; coas: Coa[]; impact: Impact }>("/api/v1/events", {
        method: "POST",
        body: JSON.stringify({ type: kind, severity: "WARNING", payload: payload() }),
      });
      setEventId(result.event_id);
      setImpact(result.impact);
      await rerank(result.coas);
      setNote(`${result.coas.length} distinct valid COAs · validator checked each.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The event did not inject.");
    } finally {
      setBusy(false);
    }
  }

  async function select(coa: Coa) {
    try {
      const result = await api<{ plan_id: string }>(`/api/v1/coas/${coa.coa_id ?? `${eventId}-${coa.id}`}/select`, {
        method: "POST",
        body: JSON.stringify({ reason: "Selected from the retask console." }),
      });
      setNote(`Draft ${result.plan_id} created — submit as planner, then commander approves.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Selection failed.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Retask console</h1>
      <p className="mt-1 text-sm text-ink-3">What happened → blast radius → COAs → decision matrix (scored on server).</p>

      {impact && (
        <article className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <h2 className="text-xs uppercase tracking-wide text-ink-3">Impact</h2>
          <p className="mt-2 font-display text-xl">{impact.summary}</p>
          {impact.t_minus_min != null && (
            <p className="mt-1 font-mono text-sm text-ember">Decision window T−{Math.max(0, impact.t_minus_min)} min</p>
          )}
          {impact.affected_missions.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {impact.affected_missions.map((id) => (
                <li key={id}>
                  <Link className="font-mono text-sm text-vyom underline" href={`/app/missions/${id}`}>
                    Why not {id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

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
        <button
          className="rounded-lg bg-ember px-4 py-3 text-surface disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={() => void inject()}
        >
          {busy ? "Replanning…" : "Inject disruption"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Value weight ({valueW})
          <input className="mt-1 block w-full" type="range" min={0} max={100} value={valueW} onChange={(e) => setValueW(Number(e.target.value))} />
        </label>
        <label className="text-sm">Stability weight ({stabW})
          <input className="mt-1 block w-full" type="range" min={0} max={100} value={stabW} onChange={(e) => setStabW(Number(e.target.value))} />
        </label>
        <label className="text-sm">Risk weight ({riskW})
          <input className="mt-1 block w-full" type="range" min={0} max={100} value={riskW} onChange={(e) => setRiskW(Number(e.target.value))} />
        </label>
        <label className="text-sm">Reserve weight ({reserveW})
          <input className="mt-1 block w-full" type="range" min={0} max={100} value={reserveW} onChange={(e) => setReserveW(Number(e.target.value))} />
        </label>
      </div>

      {note && <p className="mt-3 text-sm text-ink-2">{note}</p>}
      {error && <ErrorState message={error} />}
      {loading && <LoadingState label="Loading fleet and the latest courses of action…" />}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {coas.map((coa) => {
          const reserveRelease = coa.id === "R" || coa.name === "Reserve Release" || coa.name === "R";
          return (
          <article key={coa.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl">{coa.id} · {reserveRelease ? "Reserve release" : coa.name}</h2>
              <span className="flex shrink-0 gap-2">
                {reserveRelease && <StatusBadge tone="warn">Reserve release</StatusBadge>}
                {coa.recommended && <StatusBadge tone="ok">Recommended</StatusBadge>}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-2">{coa.rationale}</p>
            <p className="mt-2 font-mono text-sm">
              {coa.changes} changes · {coa.metrics.missions_served ?? 0} served · fulfilment{" "}
              {Math.round((coa.metrics.value_weighted_fulfilment ?? 0) * 1000) / 10}% · stability{" "}
              {Math.round((coa.metrics.stability_score ?? 0) * 1000) / 10}%
            </p>
            <p className="mt-1 text-xs text-ink-3">
              Validator {coa.validation?.valid ? "PASS" : "—"}
              {coa.matrix_score != null ? ` · matrix ${coa.matrix_score.toFixed(4)}` : ""}
            </p>
            {reserveRelease && (
              <p className="mt-2 text-sm text-ink-2">This option releases the held reserve so more missions can launch.</p>
            )}
            <button className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-sm" type="button" onClick={() => void select(coa)}>
              Select COA → new draft plan
            </button>
          </article>
          );
        })}
      </div>
      {!loading && !coas.length && !busy && !error && (
        <EmptyState
          title="No courses of action yet"
          detail="Optimise a baseline in the planner, then inject Bravo closure or T-114 NMC. A reserve-release option appears only when the solver returns preset R."
        />
      )}
    </section>
  );
}
