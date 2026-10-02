"use client";

import { useEffect, useState } from "react";
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

  async function refresh(id?: string) {
    const list = await api<{ items: Plan[] }>("/api/v1/plans");
    setPlans(list.items);
    const chosen = id ?? list.items[0]?.id;
    if (chosen) setActive(await api<Plan>(`/api/v1/plans/${chosen}`));
  }

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    api<{ items: Plan[] }>("/api/v1/plans")
      .then(async (list) => {
        setPlans(list.items);
        const chosen = list.items[0]?.id;
        if (chosen) setActive(await api<Plan>(`/api/v1/plans/${chosen}`));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Plans did not load."));
  }, []);

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
          <button className="rounded-lg bg-ember px-4 py-3 text-surface disabled:opacity-60" type="button" disabled={busy} onClick={() => void optimise()}>
            {busy ? "Optimising…" : "Optimise"}
          </button>
        )}
        {role !== "" && role !== "planner" && (
          <p className="text-sm text-ink-2">An ops planner runs the optimiser. You can read the result.</p>
        )}
      </div>
      {message && <p className="mt-4 text-sm text-moss">{message}</p>}
      {error && <p className="mt-4 text-sm text-brick" role="alert">{error}</p>}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {plans.map((plan) => (
          <button key={plan.id} className="rounded-full border border-line px-3 py-1 text-sm" type="button" onClick={() => void refresh(plan.id)}>
            {plan.id} · {plan.status}
          </button>
        ))}
      </div>
      {!active && !error && <p className="mt-8 text-ink-3">All quiet on the unscheduled front. Optimise to draw the first ATO.</p>}
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
        </div>
      )}
    </section>
  );
}
