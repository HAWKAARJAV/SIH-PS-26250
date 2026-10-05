"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Craft = { tail: string; type_id: string; base_id: string; status: string; version: number; hours_to_inspection: number };
type Feedback = { tail: string; ok: boolean; text: string };

export default function FleetPage() {
  const [rows, setRows] = useState<Craft[]>([]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const canEdit = role === "fleet";

  function load() {
    setLoading(true);
    setLoadError("");
    api<{ items: Craft[] }>("/api/v1/registers/aircraft")
      .then((data) => setRows(data.items))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "The fleet did not load."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    load();
  }, []);

  async function save(row: Craft, status: string) {
    setError("");
    setFeedback(null);
    try {
      const saved = await api<{ status: string }>(`/api/v1/aircraft/${row.tail}`, {
        method: "PATCH",
        headers: { "If-Match": String(row.version) },
        body: JSON.stringify({ status, reason: "Updated from the fleet register." }),
      });
      const text = `${row.tail} is ${saved.status}.`;
      setFeedback({ tail: row.tail, ok: true, text });
      load();
    } catch (err) {
      const text = err instanceof Error ? err.message : "That status did not save.";
      setError(text);
      setFeedback({ tail: row.tail, ok: false, text });
    }
  }

  const statusCounts = rows.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <section>
      <h1 className="font-display text-4xl">Fleet</h1>
      <PageContext
        purpose="Every aircraft tail in the loaded scenario. FMC counts feed the command glance tile; NMC tails block new assignments in the validator."
        judgeLine="Fleet Officer can change status live — other roles see closed menus with a reason, not a silent 403."
        actor="Fleet Officer edits status. Everyone else reads."
        related={[{ href: "/app", label: "Command glance" }, { href: "/app/retask", label: "Retask" }]}
      />
      {role !== "" && !canEdit && (
        <p className="mt-3 text-sm text-ink-2">A fleet officer changes aircraft status. These menus stay closed for your role. Switch role to Fleet Officer to set fully, partially, or not mission capable.</p>
      )}
      {feedback && (
        <p className={`mt-3 text-sm ${feedback.ok ? "text-moss" : "text-brick"}`} role={feedback.ok ? "status" : "alert"}>
          {feedback.text}
        </p>
      )}
      {error && feedback?.ok !== false && <p className="mt-3 text-brick" role="alert">{error}</p>}
      {loading && !rows.length && <LoadingState label="Loading the fleet…" />}
      {loadError && <ErrorState message={loadError} onRetry={load} />}
      {!loading && !loadError && !rows.length && (
        <EmptyState title="No aircraft" detail="The fleet register is empty. Load a scenario to see tails." />
      )}
      {rows.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" role="status">
          <StatusBadge tone="neutral">{rows.length} tails loaded</StatusBadge>
          {(["FMC", "PMC", "NMC"] as const).map((code) =>
            statusCounts[code] ? (
              <StatusBadge key={code} tone={code === "FMC" ? "ok" : code === "PMC" ? "warn" : "bad"}>
                {code}: {statusCounts[code]}
              </StatusBadge>
            ) : null,
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-ink-3">
              <tr>
                <th className="p-2">Tail</th>
                <th className="p-2">Type</th>
                <th className="p-2">Base</th>
                <th className="p-2">Hours to inspection</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 64).map((row) => {
                const rowFeedback = feedback?.tail === row.tail ? feedback : null;
                return (
                  <tr key={row.tail} className="border-t border-line">
                    <td className="p-2 font-mono">{row.tail}</td>
                    <td className="p-2 font-mono">{row.type_id}</td>
                    <td className="p-2">{row.base_id}</td>
                    <td className="p-2 font-mono">{row.hours_to_inspection}</td>
                    <td className="p-2">
                      <label className="block text-xs text-ink-3">
                        Status for {row.tail}
                        <select
                          className="mt-1 block rounded border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-60"
                          value={row.status}
                          disabled={!canEdit}
                          aria-describedby={`fleet-status-${row.tail}`}
                          onChange={(event) => void save(row, event.target.value)}
                        >
                          <option value="FMC">FMC — fully mission capable</option>
                          <option value="PMC">PMC — partially mission capable</option>
                          <option value="NMC">NMC — not mission capable</option>
                        </select>
                      </label>
                      <p id={`fleet-status-${row.tail}`} className={`mt-1 text-xs ${rowFeedback && !rowFeedback.ok ? "text-brick" : "text-ink-3"}`}>
                        {role !== "" && !canEdit && "Closed. A fleet officer changes this status."}
                        {canEdit && rowFeedback?.text}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
