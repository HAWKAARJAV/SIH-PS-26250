"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Entry = { seq: number; actor: string; action: string; ref: string; hash: string; reason: string };

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [verdict, setVerdict] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Entry[] }>("/api/v1/audit")
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The audit log is closed to this role."));
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
      {verdict && <p className="mt-3 text-moss">{verdict}</p>}
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
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
