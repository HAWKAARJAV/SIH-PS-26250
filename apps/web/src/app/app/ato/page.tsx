"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Plan = { id: string; status: string; digest: string };
type Ato = { plan: Plan; lines: { mission: string; call_sign: string; type: string; tail: string; start_dtg: string; load_out: string }[]; acks: { unit: string; state: string }[] };
type Diff = { summary: string; hard_violations: number };
type Action = "submit" | "approve" | "co-approve" | "publish" | "reject";

const LIFECYCLE: { action: Action; label: string; allowedRole: string; legalStatus: string; roleReason: string; statusReason: string }[] = [
  {
    action: "submit",
    label: "Submit draft — Ops Planner",
    allowedRole: "planner",
    legalStatus: "DRAFT",
    roleReason: "Only the Ops Planner can submit a draft.",
    statusReason: "Submit applies while the order is DRAFT.",
  },
  {
    action: "approve",
    label: "Approve — Commander",
    allowedRole: "commander",
    legalStatus: "PROPOSED",
    roleReason: "Only the Commander can approve.",
    statusReason: "Approve applies while the order is PROPOSED.",
  },
  {
    action: "reject",
    label: "Reject — Commander",
    allowedRole: "commander",
    legalStatus: "PROPOSED",
    roleReason: "Only the Commander can reject.",
    statusReason: "Reject applies while the order is PROPOSED.",
  },
  {
    action: "co-approve",
    label: "Co-sign — Auditor",
    allowedRole: "auditor",
    legalStatus: "APPROVED",
    roleReason: "Only the Auditor can co-sign.",
    statusReason: "Co-sign applies after the Commander has approved.",
  },
  {
    action: "publish",
    label: "Publish — Commander",
    allowedRole: "commander",
    legalStatus: "APPROVED",
    roleReason: "Only the Commander can publish.",
    statusReason: "Publish applies while the order is APPROVED.",
  },
];

export default function AtoPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [doc, setDoc] = useState<Ato | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [docError, setDocError] = useState("");

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    api<{ items: Plan[] }>("/api/v1/plans")
      .then((data) => setPlans(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Plans did not load."))
      .finally(() => setLoading(false));
  }, []);

  async function open(id: string) {
    setDocError("");
    try {
      setDoc(await api<Ato>(`/api/v1/plans/${id}/ato`));
      setDiff(await api<Diff>(`/api/v1/plans/${id}/ato-diff`));
    } catch (err) {
      setDoc(null);
      setDiff(null);
      setDocError(err instanceof Error ? err.message : "That ATO did not open.");
    }
  }

  async function pdf(id: string) {
    setError("");
    try {
      const file = await api<{ base64: string }>(`/api/v1/plans/${id}/export?fmt=pdf`);
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The PDF did not download.");
    }
  }

  async function act(id: string, action: Action) {
    setError("");
    try {
      const path = action === "co-approve" ? `/api/v1/plans/${id}/co-approve` : `/api/v1/plans/${id}/${action}`;
      const result = await api<{ status: string }>(path, { method: "POST", body: JSON.stringify({ reason: action }) });
      setNote(`${id} is ${result.status}.`);
      const data = await api<{ items: Plan[] }>("/api/v1/plans");
      setPlans(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action was refused.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">ATO / ACO</h1>
      <PageContext
        purpose="Human-gated publish path for the air tasking order. Submit → Commander approve → Auditor co-sign → Commander publish. Disabled buttons stay visible with the role or status that would unlock them."
        judgeLine="PDF download works on a draft — publish is what locks the digest into the audit chain."
        actor="Ops Planner submits; Commander approves and publishes; Auditor co-signs."
        related={[{ href: "/app/plan", label: "Planner" }, { href: "/app/audit", label: "Audit" }]}
      />
      {loading && <LoadingState label="Loading air tasking orders…" />}
      {error && <ErrorState message={error} />}
      {docError && <ErrorState message={docError} />}
      {note && <p className="mt-3 text-moss">{note}</p>}
      <ul className="mt-4 grid gap-2">
        {plans.map((plan) => (
          <li key={plan.id} className="rounded-lg border border-line bg-surface px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{plan.id}</span>
              <StatusBadge tone={plan.status === "PUBLISHED" ? "ok" : plan.status === "DRAFT" ? "neutral" : "info"}>{plan.status}</StatusBadge>
              <span className="font-mono text-xs text-ink-3">{plan.digest.slice(0, 12)}</span>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-sm text-vyom" onClick={() => void open(plan.id)}>
                View ATO
              </button>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-sm" onClick={() => void pdf(plan.id)}>
                Download PDF
              </button>
            </div>
            <ul className="mt-3 grid gap-2">
              {LIFECYCLE.map((step) => {
                const roleOk = role === step.allowedRole;
                const statusOk = plan.status === step.legalStatus;
                const enabled = roleOk && statusOk;
                const reason = !role
                  ? "Your role has not loaded, so this action stays closed."
                  : !roleOk
                    ? step.roleReason
                    : step.statusReason;
                const reasonId = `${plan.id}-${step.action}-reason`;
                return (
                  <li key={step.action} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-line px-2 py-1 text-sm disabled:cursor-not-allowed disabled:text-ink-3"
                      disabled={!enabled}
                      aria-describedby={enabled ? undefined : reasonId}
                      onClick={() => void act(plan.id, step.action)}
                    >
                      {step.label}
                    </button>
                    {!enabled && (
                      <span id={reasonId} className="text-xs text-ink-3">{reason}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {!loading && !plans.length && !error && (
        <EmptyState title="No ATO yet" detail="The planner has to optimise first." />
      )}
      {diff && (
        <section className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-3" aria-labelledby="ato-diff-heading">
          <h2 id="ato-diff-heading" className="font-display text-xl">Diff summary</h2>
          <p className="mt-2 font-mono text-sm">{diff.summary}</p>
          <p className="mt-1 text-sm text-ink-2">Validator hard violations: {diff.hard_violations}</p>
        </section>
      )}
      {doc && (
        <table className="mt-6 w-full text-left text-sm">
          <thead><tr><th>Mission</th><th>Call-sign</th><th>Type</th><th>Tail</th><th>DTG</th><th>Load-out</th></tr></thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={`${line.mission}-${line.tail}`} className="border-t border-line">
                <td className="font-mono">{line.mission}</td><td>{line.call_sign}</td><td>{line.type}</td><td className="font-mono">{line.tail}</td><td className="font-mono">{line.start_dtg}</td><td>{line.load_out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
