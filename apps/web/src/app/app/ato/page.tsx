"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Plan = { id: string; status: string; digest: string };
type Ato = { plan: Plan; lines: { mission: string; call_sign: string; type: string; tail: string; start_dtg: string; load_out: string }[]; acks: { unit: string; state: string }[] };

export default function AtoPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [doc, setDoc] = useState<Ato | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api<{ items: Plan[] }>("/api/v1/plans").then((data) => setPlans(data.items)).catch((err: unknown) => setError(err instanceof Error ? err.message : "No plans."));
  }, []);

  async function open(id: string) {
    setDoc(await api<Ato>(`/api/v1/plans/${id}/ato`));
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

  async function act(id: string, action: "submit" | "approve" | "publish") {
    setError("");
    try {
      const result = await api<{ status: string }>(`/api/v1/plans/${id}/${action}`, { method: "POST", body: JSON.stringify({ reason: action }) });
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
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      {note && <p className="mt-3 text-moss">{note}</p>}
      <ul className="mt-4 grid gap-2">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="font-mono">{plan.id}</span>
            <span>{plan.status}</span>
            <span className="font-mono text-xs text-ink-3">{plan.digest.slice(0, 12)}</span>
            <button type="button" className="text-sm text-vyom" onClick={() => void open(plan.id)}>View</button>
            <button type="button" className="text-sm" onClick={() => void act(plan.id, "submit")}>Submit</button>
            <button type="button" className="text-sm" onClick={() => void act(plan.id, "approve")}>Approve</button>
            <button type="button" className="text-sm" onClick={() => void act(plan.id, "publish")}>Publish</button>
            <button type="button" className="text-sm" onClick={() => void pdf(plan.id)}>PDF</button>
          </li>
        ))}
      </ul>
      {!plans.length && !error && <p className="mt-6 text-ink-3">No ATO yet. The planner has to optimise first.</p>}
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
