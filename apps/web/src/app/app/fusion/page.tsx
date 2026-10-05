"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Source = { id: string; name: string; status?: string; degraded?: boolean; domain: string };
type Observation = { source_id: string; value: string };
type Conflict = { entity_ref: string; field: string; policy: string; observations: Observation[] };

export default function FusionPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [fusion, setFusion] = useState<{ feeds_live?: number; feeds_total?: number } | null>(null);

  function load() {
    setLoading(true);
    setError("");
    api<{ items: Source[] }>("/api/v1/registers/sources")
      .then((data) => setSources(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Feeds did not load."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
    load();
    api<{ fusion?: { feeds_live: number; feeds_total: number } }>("/api/v1/fusion/snapshot")
      .then((data) => setFusion(data.fusion ?? null))
      .catch(() => setFusion(null));
  }, []);

  async function degrade(source: Source) {
    setNote("");
    setError("");
    const stale = isStale(source);
    try {
      const updated = await api<Source>(`/api/v1/fusion/${source.id}/degrade`, { method: "POST" });
      const nowStale = isStale(updated);
      setNote(
        nowStale
          ? `${source.id} is DEGRADED. The optimiser treats that feed as stale.`
          : `${source.id} is LIVE again.`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : stale ? "Only an admin can restore a feed." : "Only an admin can mark a feed stale.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">COP Health</h1>
      <PageContext
        purpose="Eight simulated intelligence feeds fuse into one snapshot for the optimiser. Degraded feeds stay visible — they tighten constraints instead of disappearing."
        judgeLine="Conflict inbox shows when two feeds disagree on the same tail or crew row."
        actor="Admin marks feeds stale or restores them. Everyone reads feed status."
        label={fusion ? <StatusBadge tone="ok">FUSION {fusion.feeds_live}/{fusion.feeds_total} LIVE</StatusBadge> : undefined}
        related={[{ href: "/app/plan", label: "Planner" }, { href: "/app", label: "Command glance" }]}
      />
      {loading && <LoadingState label="Loading feeds…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {note && <p className="mt-3 text-moss">{note}</p>}
      {!loading && !error && !sources.length && <EmptyState title="No feeds" detail="The source register came back empty." />}
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {sources.map((source) => {
          const stale = isStale(source);
          return (
            <li key={source.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-1)]">
              <div>
                <p className="font-mono">{source.id}</p>
                <p className="text-sm text-ink-2">{source.name}</p>
                <p className="text-sm">Domain {source.domain}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge tone={stale ? "warn" : "ok"}>{stale ? "DEGRADED" : "LIVE"}</StatusBadge>
                <button
                  className="rounded-full border border-line px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={role !== "admin"}
                  aria-label={`${stale ? "Restore" : "Mark stale"} ${source.name}`}
                  onClick={() => void degrade(source)}
                >
                  {stale ? `Restore ${source.id}` : `Mark ${source.id} stale`}
                </button>
                {role !== "admin" && <p className="max-w-40 text-right text-xs text-ink-3">An admin marks a feed stale. This stays closed for your role.</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <ConflictInbox />
    </section>
  );
}

function isStale(source: { degraded?: boolean; status?: string }) {
  return Boolean(source.degraded) || source.status === "DEGRADED";
}

function ConflictInbox() {
  const [items, setItems] = useState<Conflict[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ items: Conflict[] }>("/api/v1/fusion/conflicts")
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Conflicts did not load."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="mt-6">
      <h2 className="font-display text-2xl">Conflict inbox</h2>
      <p className="mt-2 text-sm text-ink-2">
        When two feeds disagree, both values stay listed. The policy says which reading the picture keeps.
      </p>
      {loading && <LoadingState label="Loading the conflict inbox…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && !items.length && <EmptyState title="No open conflicts" detail="The seeded picture has none." />}
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article key={`${item.entity_ref}-${item.field}`} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-mono">{item.entity_ref} · {item.field}</p>
            <p className="mt-2 text-sm">
              Both values: {item.observations.map((row) => `${row.source_id} says ${row.value}`).join("; ")}.
            </p>
            <p className="mt-2 text-sm text-ink-2">Policy: {item.policy}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
