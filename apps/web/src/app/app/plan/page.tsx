"use client";

import { useEffect, useState } from "react";
import { Gantt } from "@/components/gantt";
import { PageContext } from "@/components/page-context";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Assignment = { mission_id: string; tail: string; start: string; end: string; load_out: string };
type Plan = { id: string; status: string; label: string; kpis: { missions_served?: number; missions_total?: number; value_weighted_fulfilment?: number }; assignments?: Assignment[] };

const ROLE_LABEL: Record<string, string> = {
  commander: "Commander",
  planner: "Ops Planner",
  fleet: "Fleet Officer",
  crew_officer: "Crew Officer",
  analyst: "Situation Analyst",
  auditor: "Auditor",
  admin: "Admin",
};

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<Plan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [roleReady, setRoleReady] = useState(false);
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
    api<{ role: string }>("/api/v1/auth/me")
      .then((me) => setRole(me.role))
      .catch(() => setRole(""))
      .finally(() => setRoleReady(true));
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
      item.mission_id === row.mission_id
        ? { ...item, start: move(item.start, minutes), end: move(item.end, minutes) }
        : item,
    );
    try {
      await api(`/api/v1/plans/${active.id}/assignments`, { method: "PUT", body: JSON.stringify({ assignments: next }) });
      setActive({ ...active, assignments: next });
      setMessage(`${row.mission_id} moved ${minutes} minutes later on every aircraft in that package. The checker accepted it.`);
      setError("");
    } catch (err) {
      setMessage("");
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
      if (report.valid) {
        setMessage("Validator PASS · 0 hard violations. Next: Submit sends this plan to the commander.");
        setError("");
      } else {
        setMessage("");
        const server = report.violations.map((row) => row.message).filter(Boolean).join(" ");
        setError(server || "Validation failed.");
      }
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Validation failed.");
    }
  }

  async function submitPlan() {
    if (!active) return;
    setError("");
    try {
      await api(`/api/v1/plans/${active.id}/submit`, { method: "POST", body: JSON.stringify({ reason: "Planner submission." }) });
      setMessage(`${active.id} submitted for commander approval. Next: the commander approves it.`);
      setError("");
      await refresh(active.id);
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Submit failed.");
    }
  }

  async function optimise() {
    setBusy(true);
    setError("");
    setMessage("Untangling the schedule…");
    try {
      const result = await api<{ plan_id: string; label: string; validation: { valid: boolean; violations: { message: string }[] } }>("/api/v1/plans/optimise", { method: "POST" });
      if (result.validation.valid) {
        setMessage(`Plan ${result.plan_id} is valid. Zero violations. ${result.label} Next: press Validate, then Submit for the commander.`);
        setError("");
      } else {
        setMessage("");
        const server = result.validation.violations.map((row) => row.message).filter(Boolean).join(" ");
        setError(server || `Plan ${result.plan_id} did not validate.`);
      }
      await refresh(result.plan_id);
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Optimise failed.");
    } finally {
      setBusy(false);
    }
  }

  const canPlan = roleReady && role === "planner";
  const roleName = ROLE_LABEL[role] || role;
  const gate = !roleReady
    ? "Checking who is signed in. Optimise, Validate, and Submit stay off until that returns."
    : role === "planner"
      ? "You are the Ops Planner. These three controls are yours."
      : role === ""
        ? "Sign in as Ops Planner and press Optimise. Validate and Submit stay off until that role is signed in."
        : `Optimise, Validate, and Submit are for the Ops Planner. You are signed in as ${roleName}, so those buttons stay off. You can read the plan.`;

  return (
    <section>
      <h1 className="font-display text-4xl">Planner</h1>
      <PageContext
        purpose="Build and tune the air tasking schedule. Optimise calls the solver on the fused snapshot; Validate runs the same hard-rule checker as publish."
        judgeLine="Gantt bar click shifts every aircraft in a mission package by 15 minutes — the server accepts or rejects with a plain-language violation."
        actor="Ops Planner optimises, validates, and submits. Commander and others read the Gantt."
        related={[{ href: "/app/ato", label: "ATO handoff" }, { href: "/app/missions", label: "Missions" }]}
      />
      <p className="mt-2 max-w-3xl text-sm text-ink-2">{gate}</p>
      <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-1)] sm:grid-cols-3">
        <div>
          <button className="w-full rounded-xl bg-ember px-4 py-3 text-surface disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!canPlan || busy} onClick={() => void optimise()}>
            {busy ? "Optimising the flying day…" : "Optimise the flying day"}
          </button>
          <p className="mt-1 text-xs text-ink-2">
            {canPlan
              ? "For the Ops Planner. Builds a new plan from the live snapshot. Next: press Check this plan."
              : "Optimise the flying day is for the Ops Planner, so this button stays off."}
          </p>
        </div>
        <div>
          <button className="w-full rounded-xl border border-line-strong bg-canvas px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!canPlan || !active} onClick={() => void validatePlan()}>
            Check this plan
          </button>
          <p className="mt-1 text-xs text-ink-2">
            {!canPlan
              ? "Check this plan is for the Ops Planner, so this button stays off."
              : !active
                ? "Closed until a draft exists. After Optimise the flying day, this asks the server to check hard rules."
                : "Asks the server to check hard rules on this plan. Next: Submit for commander approval if it passes."}
          </p>
        </div>
        <div>
          <button className="w-full rounded-xl border border-line-strong bg-canvas px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!canPlan || !active || active.status !== "DRAFT"} onClick={() => void submitPlan()}>
            Submit for commander approval
          </button>
          <p className="mt-1 text-xs text-ink-2">
            {!canPlan
              ? "Submit for commander approval is for the Ops Planner, so this button stays off."
              : !active
                ? "Closed until a draft exists. It sends that plan to the commander."
                : active.status !== "DRAFT"
                  ? `This plan is ${active.status}. Only a draft can be submitted.`
                  : "Sends this draft to the commander for approval."}
          </p>
        </div>
      </div>
      {message && <p className="mt-4 text-sm text-moss">{message}</p>}
      {loading && <LoadingState label="Loading plans…" />}
      {error && <ErrorState message={error} />}
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {plans.map((plan) => (
          <button
            key={plan.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${active?.id === plan.id ? "border-ember bg-surface-2" : "border-line bg-surface"}`}
            type="button"
            aria-pressed={active?.id === plan.id}
            onClick={() => void refresh(plan.id)}
          >
            <span className="font-mono">{plan.id}</span>
            <StatusBadge tone={plan.status === "PUBLISHED" ? "ok" : plan.status === "DRAFT" ? "neutral" : "info"}>{plan.status}</StatusBadge>
          </button>
        ))}
      </div>
      {!loading && !active && !error && (
        <EmptyState title="No plan yet" detail="Sign in as Ops Planner and press Optimise." />
      )}
      {active && epoch && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-ink-2">
            {canPlan
              ? "Click a bar to move that mission 15 minutes later. Every aircraft in the same package moves together."
              : "The bars are a picture of the plan. An ops planner can shift them."}
          </p>
          <Gantt rows={active.assignments ?? []} epoch={epoch} onShift={canPlan ? (row, minutes) => void shift(row, minutes) : undefined} />
        </div>
      )}
      {active && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-1)]">
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
