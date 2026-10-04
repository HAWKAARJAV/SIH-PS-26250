"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Plan = { id: string; status: string; digest: string };
type Ato = { plan: Plan; lines: { mission: string; call_sign: string; type: string; tail: string; start_dtg: string; load_out: string }[]; acks: { unit: string; state: string }[] };
type Diff = { summary: string; hard_violations: number };

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

  async function act(id: string, action: "submit" | "approve" | "co-approve" | "publish" | "reject") {
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

  const canSubmit = role === "planner";
  const canApprove = role === "commander";
  const canCoSign = role === "auditor";
  const canPublish = role === "commander";

  return (
    <section>
      <h1 className="font-display text-4xl">ATO / ACO</h1>
      <p className="mt-1 text-sm text-ink-3">Lifecycle actions are role-gated on the server.</p>
      {loading && <LoadingState label="Loading air tasking orders…" />}
      {error && <ErrorState message={error} />}
      {docError && <ErrorState message={docError} />}
      {note && <p className="mt-3 text-moss">{note}</p>}
      <ul className="mt-4 grid gap-2">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="font-mono">{plan.id}</span>
            <StatusBadge tone={plan.status === "PUBLISHED" ? "ok" : plan.status === "DRAFT" ? "neutral" : "info"}>{plan.status}</StatusBadge>
            <span className="font-mono text-xs text-ink-3">{plan.digest.slice(0, 12)}</span>
            <button type="button" className="text-sm text-vyom" onClick={() => void open(plan.id)}>View</button>
            {canSubmit && plan.status === "DRAFT" && (
              <button type="button" className="text-sm" onClick={() => void act(plan.id, "submit")}>Submit</button>
            )}
            {canApprove && plan.status === "PROPOSED" && (
              <>
                <button type="button" className="text-sm" onClick={() => void act(plan.id, "approve")}>Approve</button>
                <button type="button" className="text-sm" onClick={() => void act(plan.id, "reject")}>Reject</button>
              </>
            )}
            {canCoSign && plan.status === "APPROVED" && (
              <button type="button" className="text-sm" onClick={() => void act(plan.id, "co-approve")}>Co-sign</button>
            )}
            {canPublish && plan.status === "APPROVED" && (
              <button type="button" className="text-sm" onClick={() => void act(plan.id, "publish")}>Publish</button>
            )}
            <button type="button" className="text-sm" onClick={() => void pdf(plan.id)}>PDF</button>
          </li>
        ))}
      </ul>
      {!loading && !plans.length && !error && (
        <EmptyState title="No ATO yet" detail="The planner has to optimise first." />
      )}
      {diff && <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">ATO diff: {diff.summary} · validator hard violations {diff.hard_violations}</p>}
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
