"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { ApiError, api } from "@/lib/api";

type Entry = { seq: number; at: string; actor: string; action: string; ref: string; hash: string; reason: string };

const READERS = "The auditor, commander, or admin can read the log.";

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [verdict, setVerdict] = useState("");
  const [passed, setPassed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [forbidden, setForbidden] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    setForbidden(false);
    api<{ items: Entry[] }>("/api/v1/audit")
      .then((data) => setItems(data.items))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          setError(`${err.message} ${READERS}`);
          return;
        }
        setError(err instanceof Error ? err.message : READERS);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    load();
  }, []);

  async function verify() {
    try {
      const result = await api<{ valid: boolean; entries: number }>("/api/v1/audit/verify", { method: "POST" });
      setPassed(result.valid);
      setVerdict(result.valid ? `PASS. Chain intact. ${result.entries} entries.` : "FAIL. The chain is broken.");
    } catch (err) {
      setPassed(null);
      setError(err instanceof Error ? err.message : "Only an auditor can verify.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Audit</h1>
      <PageContext
        purpose="Append-only hash chain of privileged actions. Each entry stores actor, action, time, and a hash linked to the previous row."
        judgeLine="Auditor runs Verify — PASS means the chain was not tampered with since publish."
        actor="Auditor, Commander, or Admin reads the log. Only Auditor verifies the chain."
        related={[{ href: "/app/ato", label: "ATO" }, { href: "/app/judge", label: "Judge tour" }]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="sr-only">Audit actions</p>
        <div className="max-w-md">
          <button className="rounded-lg border border-line-strong px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={role !== "auditor"} onClick={() => void verify()}>
            Verify the audit chain — auditor
          </button>
          {role !== "" && role !== "auditor" && (
            <p className="mt-2 text-sm text-ink-3">Only an auditor can verify the chain. Switch role to Auditor, then press this button.</p>
          )}
          <p className="mt-2 text-sm text-ink-3">
            PASS means the hash chain is intact: each entry still matches the one before it. FAIL means an entry was altered or a link is missing.
          </p>
        </div>
      </div>
      {verdict && passed !== null && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <StatusBadge tone={passed ? "ok" : "bad"}>{passed ? "PASS" : "FAIL"}</StatusBadge>
          {verdict}
        </p>
      )}
      {loading && <LoadingState label="Loading the audit chain…" />}
      {error && <ErrorState message={error} onRetry={forbidden ? undefined : load} />}
      {!loading && !error && !items.length && (
        <EmptyState title="No audit entries" detail={`${READERS} Nothing is in the chain for this session.`} />
      )}
      {items.length > 0 && (
        <p className="mt-3">
          <StatusBadge tone="neutral">{items.length} entries in chain</StatusBadge>
        </p>
      )}
      <ul className="mt-4 grid gap-2">
        {items.map((row) => (
          <li key={row.seq} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <p><span className="text-ink-3">Actor </span>{row.actor}</p>
            <p><span className="text-ink-3">Action </span>{row.action}</p>
            <p><span className="text-ink-3">Time </span><time dateTime={row.at}>{row.at}</time></p>
            <p className="mt-1 text-xs text-ink-3">
              <span className="font-mono">#{row.seq}</span>
              {row.ref ? ` · ${row.ref}` : ""}
              <span className="ml-2 font-mono">{row.hash.slice(0, 12)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
