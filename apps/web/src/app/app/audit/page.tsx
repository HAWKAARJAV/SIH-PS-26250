"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Entry = { seq: number; actor: string; action: string; ref: string; hash: string; reason: string };

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [verdict, setVerdict] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError("");
    api<{ items: Entry[] }>("/api/v1/audit")
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The audit log is closed to this role."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function verify() {
    try {
      const result = await api<{ valid: boolean; entries: number }>("/api/v1/audit/verify", { method: "POST" });
      setVerdict(result.valid ? `Chain intact. ${result.entries} entries.` : "The chain is broken.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Only an auditor can verify.");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl">Audit</h1>
        <button className="rounded-lg border border-line-strong px-3 py-2" type="button" onClick={() => void verify()}>Verify integrity</button>
      </div>
      {verdict && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <StatusBadge tone={verdict.startsWith("Chain intact") ? "ok" : "bad"}>{verdict.startsWith("Chain intact") ? "PASS" : "FAIL"}</StatusBadge>
          {verdict}
        </p>
      )}
      {loading && <LoadingState label="Loading the audit chain…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && !items.length && <EmptyState title="No audit entries" detail="The chain is empty for this session." />}
      <ul className="mt-4 grid gap-2">
        {items.map((row) => (
          <li key={row.seq} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <span className="font-mono">#{row.seq}</span> {row.action} · {row.ref} · {row.actor}
            <span className="ml-2 font-mono text-xs text-ink-3">{row.hash.slice(0, 12)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
