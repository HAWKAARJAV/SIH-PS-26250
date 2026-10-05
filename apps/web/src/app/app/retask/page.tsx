"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageContext } from "@/components/page-context";
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
  affected_aircraft?: string[];
  affected_crews?: string[];
  affected_tankers?: string[];
  affected_bases?: string[];
  decision_deadline?: string;
  t_minus_min?: number;
};

const KINDS = ["AIRCRAFT_NMC", "WEATHER_UPDATE", "BASE_STATUS"] as const;

const PRESET_NAMES: Record<string, string> = {
  A: "Minimal Change",
  B: "Maximum Value",
  C: "Lowest Risk",
  D: "Robust",
  R: "Reserve Release",
};

function spokenTail(tail: string) {
  if (!tail) return "unselected";
  return tail.replace(/^TAIL-/i, "T-");
}

function eventLabel(kind: string, tail: string) {
  if (kind === "AIRCRAFT_NMC") return `Aircraft ${spokenTail(tail)} non-mission-capable`;
  if (kind === "BASE_STATUS") return "Close base Bravo";
  if (kind === "WEATHER_UPDATE") return "Weather update at base Bravo";
  return kind;
}

function presetName(coa: Coa) {
  return PRESET_NAMES[coa.id] || PRESET_NAMES[coa.name] || (coa.name && coa.name !== coa.id ? coa.name : coa.id);
}

function percentOrDash(value: number | undefined) {
  if (value == null) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

type Aircraft = { tail: string; status: string };

export default function RetaskPage() {
  const [tails, setTails] = useState<Aircraft[]>([]);
  const [tail, setTail] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("AIRCRAFT_NMC");
  const [coas, setCoas] = useState<Coa[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [valueW, setValueW] = useState(40);
  const [stabW, setStabW] = useState(50);
  const [riskW, setRiskW] = useState(30);
  const [reserveW, setReserveW] = useState(40);
  const coasRef = useRef<Coa[]>([]);
  coasRef.current = coas;

  const rerank = useCallback(async (list: Coa[]) => {
    if (!list.length) return;
    try {
      const ranked = await api<{ items: Coa[] }>("/api/v1/coas/rank", {
        method: "POST",
        body: JSON.stringify({ value: valueW, stability: stabW, risk: riskW, reserve: reserveW, coas: list }),
      });
      setCoas(ranked.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The server could not re-rank these courses of action.");
    }
  }, [valueW, stabW, riskW, reserveW]);

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    let pending = 2;
    function done() {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    }
    Promise.all([
      api<{ items: Aircraft[] }>("/api/v1/registers/aircraft"),
      api<{ items: { id: string }[] }>("/api/v1/plans").then(async (list) => {
        const id = list.items[0]?.id;
        if (!id) return [] as string[];
        const plan = await api<{ assignments?: { tail: string }[] }>(`/api/v1/plans/${id}`);
        return [...new Set((plan.assignments ?? []).map((row) => row.tail))];
      }).catch(() => [] as string[]),
    ]).then(([data, tasked]) => {
      const fmc = data.items.filter((row) => row.status === "FMC");
      const onPlan = fmc.filter((row) => tasked.includes(row.tail));
      const shown = onPlan.length ? onPlan : fmc;
      setTails(shown);
      setTail(shown[0]?.tail ?? "");
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
      setNote("");
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
      setError("");
      setNote(`Draft ${result.plan_id} created for the commander. Next: an Ops Planner submits it, then the commander approves.`);
    } catch (err) {
      setNote("");
      setError(err instanceof Error ? err.message : "Selection failed.");
    }
  }

  const injectOff = busy || (kind === "AIRCRAFT_NMC" && !tail);
  const injectWhy = busy
    ? "Inject is off while the server builds courses of action. Wait until this solve finishes."
    : kind === "AIRCRAFT_NMC" && !tail
      ? "Inject is off until an aircraft is selected."
      : "Inject sends this event to the server and returns a blast radius plus courses of action.";

  return (
    <section>
      <h1 className="font-display text-4xl">Retask console</h1>
      <PageContext
        purpose="Inject a disruption against the current baseline plan, read the blast radius, then compare ranked courses of action. Selecting a COA creates a draft plan for the commander."
        judgeLine="Weight sliders only re-rank COAs that already exist — inject first, then tune."
        actor="Commander selects a COA. Ops Planner injects events and reads cards."
        related={[{ href: "/app", label: "Command glance" }, { href: "/app/plan", label: "Planner baseline" }]}
      />

      {impact && (
        <article className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <h2 className="text-xs uppercase tracking-wide text-ink-3">Blast radius</h2>
          <p className="mt-2 text-sm text-ink-2">
            Blast radius is the set of missions this event can change, plus the aircraft, crews, tankers, and bases tied to those missions.
          </p>
          <p className="mt-2 font-display text-xl">{impact.summary}</p>
          {impact.t_minus_min != null && (
            <p className="mt-1 font-mono text-sm text-ember">Decision window T−{Math.max(0, impact.t_minus_min)} min</p>
          )}
          {impact.affected_aircraft && impact.affected_aircraft.length > 0 && (
            <p className="mt-2 text-sm text-ink-2">Aircraft in the radius: {impact.affected_aircraft.join(", ")}</p>
          )}
          {impact.affected_crews && impact.affected_crews.length > 0 && (
            <p className="mt-1 text-sm text-ink-2">Crews in the radius: {impact.affected_crews.join(", ")}</p>
          )}
          {impact.affected_tankers && impact.affected_tankers.length > 0 && (
            <p className="mt-1 text-sm text-ink-2">Tankers in the radius: {impact.affected_tankers.join(", ")}</p>
          )}
          {impact.affected_bases && impact.affected_bases.length > 0 && (
            <p className="mt-1 text-sm text-ink-2">Bases in the radius: {impact.affected_bases.join(", ")}</p>
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
        <label className="text-sm">Aircraft
          <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={tail} onChange={(e) => setTail(e.target.value)}>
            {tails.slice(0, 40).map((row) => <option key={row.tail} value={row.tail}>{spokenTail(row.tail)}</option>)}
          </select>
        </label>
        <label className="text-sm">Event type
          <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {KINDS.map((id) => <option key={id} value={id}>{eventLabel(id, tail)}</option>)}
          </select>
        </label>
        <button
          className="rounded-lg bg-ember px-4 py-3 text-surface disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={injectOff}
          aria-describedby="inject-why"
          onClick={() => void inject()}
        >
          Inject disruption
        </button>
      </div>
      <p id="inject-why" className="mt-2 text-sm text-ink-2">{injectWhy}</p>

      <fieldset className="mt-6">
        <legend className="text-sm text-ink-2">Decision-matrix weights. The server re-ranks courses of action with these. 0 ignores that pull. 100 is full pull.</legend>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-sm">Value weight ({valueW}) — how much mission fulfilment counts
            <input className="mt-1 block w-full" type="range" min={0} max={100} value={valueW} onChange={(e) => setValueW(Number(e.target.value))} />
          </label>
          <label className="text-sm">Stability weight ({stabW}) — how much keeping the current plan counts
            <input className="mt-1 block w-full" type="range" min={0} max={100} value={stabW} onChange={(e) => setStabW(Number(e.target.value))} />
          </label>
          <label className="text-sm">Risk weight ({riskW}) — how much hard-rule risk counts against a course of action
            <input className="mt-1 block w-full" type="range" min={0} max={100} value={riskW} onChange={(e) => setRiskW(Number(e.target.value))} />
          </label>
          <label className="text-sm">Reserve weight ({reserveW}) — how much holding the reserve counts
            <input className="mt-1 block w-full" type="range" min={0} max={100} value={reserveW} onChange={(e) => setReserveW(Number(e.target.value))} />
          </label>
        </div>
      </fieldset>

      {note && <p className="mt-3 text-sm text-ink-2">{note}</p>}
      {error && <ErrorState message={error} />}
      {loading && <LoadingState label="Loading fleet and the latest courses of action…" />}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {coas.map((coa) => {
          const name = presetName(coa);
          const reserveRelease = coa.id === "R" || coa.name === "Reserve Release" || coa.name === "R" || name === "Reserve Release";
          const validator = coa.validation == null ? "not returned" : coa.validation.valid ? "PASS" : "FAIL";
          return (
          <article key={coa.id} className={`rounded-2xl border bg-surface p-4 shadow-[var(--shadow-1)] ${coa.recommended ? "border-ember/50" : "border-line"}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl">{name}</h2>
              <span className="flex shrink-0 gap-2">
                {reserveRelease && <StatusBadge tone="warn">Reserve release</StatusBadge>}
                {coa.recommended && <StatusBadge tone="ok">Recommended</StatusBadge>}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-3">Preset {coa.id}</p>
            {coa.rationale && <p className="mt-2 text-sm text-ink-2">{coa.rationale}</p>}
            <p className="mt-2 font-mono text-sm">
              Fulfilment {percentOrDash(coa.metrics.value_weighted_fulfilment)} · {coa.changes} changes · Validator {validator}
              {coa.metrics.missions_served != null ? ` · ${coa.metrics.missions_served} served` : ""}
              {coa.metrics.stability_score != null ? ` · stability ${percentOrDash(coa.metrics.stability_score)}` : ""}
              {coa.matrix_score != null ? ` · matrix ${coa.matrix_score.toFixed(4)}` : ""}
            </p>
            {reserveRelease && (
              <p className="mt-2 text-sm text-ink-2">This option releases the held reserve so more missions can launch.</p>
            )}
            <button
              className="mt-3 cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={role !== "commander"}
              onClick={() => void select(coa)}
            >
              Select this course of action — commander
            </button>
            {role !== "commander" && (
              <p className="mt-2 text-xs text-ink-3">A commander selects the course of action. Switch role, then press this button. It writes a new draft.</p>
            )}
          </article>
          );
        })}
      </div>
      {!loading && !coas.length && !busy && !error && (
        <EmptyState
          title={impact ? "No valid course of action" : "No courses of action yet"}
          detail={
            impact
              ? "The disruption landed, and the solver did not return a valid option. Try Close base Bravo, or pick a tail that is on the current plan."
              : "Optimise a baseline in the planner, then press Inject disruption. A commander selects the card that comes back."
          }
        />
      )}
    </section>
  );
}
