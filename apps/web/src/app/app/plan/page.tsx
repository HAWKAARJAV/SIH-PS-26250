"use client";

import { useEffect, useState } from "react";
import { Gantt } from "@/components/gantt";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Assignment = { mission_id: string; tail: string; start: string; end: string; load_out: string };
type Plan = { id: string; status: string; label: string; kpis: { missions_served?: number; missions_total?: number; value_weighted_fulfilment?: number }; assignments?: Assignment[] };

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<Plan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [epoch, setEpoch] = useState("");
  const [missionIds, setMissionIds] = useState<string[]>([]);

  async function refresh(id?: string) {
    const list = await api<{ items: Plan[] }>("/api/v1/plans");
    setPlans(list.items);
    const chosen = id ?? list.items[0]?.id;
    if (chosen) setActive(await api<Plan>(`/api/v1/plans/${chosen}`));
  }

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    api<{ epoch: string }>("/api/v1/clock").then((clock) => setEpoch(clock.epoch)).catch(() => setEpoch(""));
    api<{ items: { id: string }[] }>("/api/v1/registers/missions").then((data) => setMissionIds(data.items.map((row) => row.id))).catch(() => setMissionIds([]));
    api<{ items: Plan[] }>("/api/v1/plans")
      .then(async (list) => {
        setPlans(list.items);
        const chosen = list.items[0]?.id;
        if (chosen) setActive(await api<Plan>(`/api/v1/plans/${chosen}`));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Plans did not load."))
      .finally(() => setLoading(false));
  }, []);

  async function shift(row: Assignment, minutes: number) {
    if (!active?.assignments) return;
    const next = active.assignments.map((item) =>
      item.mission_id === row.mission_id && item.tail === row.tail && item.start === row.start
        ? { ...item, start: move(item.start, minutes), end: move(item.end, minutes) }
        : item,
    );
    try {
      await api(`/api/v1/plans/${active.id}/assignments`, { method: "PUT", body: JSON.stringify({ assignments: next }) });
      setActive({ ...active, assignments: next });
      setMessage("The move checked out. Zero new violations.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That move snapped back.");
    }
  }

  async function validatePlan() {
    if (!active?.assignments) return;
    setError("");
    try {
      const report = await api<{ valid: boolean; violations: { message: string }[] }>("/api/v1/plans/validate", {
        method: "POST",
        body: JSON.stringify({ assignments: active.assignments }),
      });
      setMessage(report.valid ? "Validator PASS · 0 hard violations." : report.violations[0]?.message || "Validation failed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    }
  }

  async function submitPlan() {
    if (!active) return;
    setError("");
    try {
      await api(`/api/v1/plans/${active.id}/submit`, { method: "POST", body: JSON.stringify({ reason: "Planner submission." }) });
      setMessage(`${active.id} submitted for commander approval.`);
      await refresh(active.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    }
  }

  async function optimise() {
    setBusy(true);
    setError("");
    setMessage("Untangling the schedule…");
    try {
      const result = await api<{ plan_id: string; label: string; validation: { valid: boolean; violations: { message: string }[] } }>("/api/v1/plans/optimise", { method: "POST" });
      setMessage(result.validation.valid ? `Plan ${result.plan_id} is valid. Zero violations. ${result.label}` : result.validation.violations[0]?.message || "The plan did not validate.");
      await refresh(result.plan_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimise failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Planner</h1>
        {role === "planner" && (
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-ember px-4 py-3 text-surface disabled:opacity-60" type="button" disabled={busy} onClick={() => void optimise()}>
              {busy ? "Optimising…" : "Optimise"}
            </button>
            <button className="rounded-lg border border-line-strong px-4 py-3" type="button" onClick={() => void validatePlan()}>Validate</button>
            <button className="rounded-lg border border-line-strong px-4 py-3" type="button" onClick={() => void submitPlan()}>Submit</button>
          </div>
        )}
        {role !== "" && role !== "planner" && (
          <p className="text-sm text-ink-2">An ops planner runs the optimiser. You can read the result.</p>
        )}
      </div>
      {message && <p className="mt-4 text-sm text-moss">{message}</p>}
      {loading && <LoadingState label="Loading plans…" />}
      {error && <ErrorState message={error} />}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {plans.map((plan) => (
          <button key={plan.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm" type="button" onClick={() => void refresh(plan.id)}>
            <span className="font-mono">{plan.id}</span>
            <StatusBadge tone={plan.status === "PUBLISHED" ? "ok" : plan.status === "DRAFT" ? "neutral" : "info"}>{plan.status}</StatusBadge>
          </button>
        ))}
      </div>
      {!loading && !active && !error && (
        <EmptyState title="No plan yet" detail="All quiet on the unscheduled front. Optimise to draw the first ATO." />
      )}
      {active && epoch && <div className="mt-6"><Gantt rows={active.assignments ?? []} epoch={epoch} onShift={(row, minutes) => void shift(row, minutes)} /></div>}
      {active && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Assignments in {active.id}</caption>
            <thead className="bg-surface-2 text-ink-3">
              <tr><th className="p-2">Mission</th><th>Tail</th><th>Load-out</th><th>Start</th><th>End</th></tr>
            </thead>
            <tbody>
              {(active.assignments ?? []).map((row) => (
                <tr key={`${row.mission_id}-${row.tail}`} className="border-t border-line">
                  <td className="p-2 font-mono">{row.mission_id}</td>
                  <td className="font-mono">{row.tail}</td>
                  <td>{row.load_out}</td>
                  <td className="font-mono">{row.start.slice(11, 16)}Z</td>
                  <td className="font-mono">{row.end.slice(11, 16)}Z</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-sm text-ink-2">
            Served {active.kpis.missions_served ?? 0} of {active.kpis.missions_total ?? 0}. Fulfilment{" "}
            {active.kpis.value_weighted_fulfilment != null ? `${Math.round(active.kpis.value_weighted_fulfilment * 1000) / 10}%` : "—"}.
          </p>
          <Unserved served={new Set((active.assignments ?? []).map((row) => row.mission_id))} missions={missionIds} />
        </div>
      )}
    </section>
  );
}

function Unserved({ served, missions }: { served: Set<string>; missions: string[] }) {
  const missing = missions.filter((id) => !served.has(id));
  if (!missing.length) return null;
  return (
    <p className="px-3 pb-3 text-sm text-ink-2">
      Not on this plan: {missing.slice(0, 8).map((id) => (
        <a key={id} className="mr-2 font-mono text-vyom" href={`/app/missions/${id}`}>{id}</a>
      ))}
    </p>
  );
}

function move(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}
