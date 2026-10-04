"use client";

import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Source = { id: string; name: string; status?: string; degraded?: boolean; domain: string };

export default function FusionPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<{ items: Source[] }>("/api/v1/registers/sources")
      .then((data) => setSources(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Feeds did not load."))
      .finally(() => setLoading(false));
  }
  const [fusion, setFusion] = useState<{ feeds_live?: number; feeds_total?: number } | null>(null);

  useEffect(() => {
    load();
    api<{ fusion?: { feeds_live: number; feeds_total: number } }>("/api/v1/fusion/snapshot")
      .then((data) => setFusion(data.fusion ?? null))
      .catch(() => setFusion(null));
  }, []);

  async function degrade(id: string) {
    setNote("");
    try {
      await api(`/api/v1/fusion/${id}/degrade`, { method: "POST" });
      setNote(`${id} flipped. The optimiser will treat that feed as stale.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Only an admin can degrade a feed.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">COP Health</h1>
      <p className="mt-2 text-sm text-ink-2">
        Eight feeds. A stale feed tightens the plan instead of being ignored.
        {fusion && (
          <span className="ml-2 font-mono text-ink">FUSION {fusion.feeds_live}/{fusion.feeds_total} LIVE</span>
        )}
      </p>
      {loading && <LoadingState label="Loading feeds…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {note && <p className="mt-3 text-moss">{note}</p>}
      {!loading && !error && !sources.length && <EmptyState title="No feeds" detail="The source register came back empty." />}
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
            <div>
              <p className="font-mono">{source.id}</p>
              <p className="text-sm text-ink-2">{source.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={source.degraded ? "warn" : "ok"}>{source.degraded ? "DEGRADED" : source.status || "LIVE"}</StatusBadge>
              <button className="rounded-full border border-line px-3 py-1 text-sm" type="button" onClick={() => void degrade(source.id)}>
                {source.degraded ? "Restore" : "Degrade"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ConflictInbox />
    </section>
  );
}

function ConflictInbox() {
  const [items, setItems] = useState<{ entity_ref: string; field: string; policy: string; observations: { source_id: string; value: string }[] }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ items: { entity_ref: string; field: string; policy: string; observations: { source_id: string; value: string }[] }[] }>("/api/v1/fusion/conflicts")
      .then((data) => setItems(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Conflicts did not load."))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingState label="Loading the conflict inbox…" />;
  if (error) return <ErrorState message={error} />;
  if (!items.length) return <EmptyState title="No open conflicts" detail="The seeded picture has nothing in the conflict inbox." />;
  return (
    <div className="mt-6 grid gap-3">
      <h2 className="font-display text-2xl">Conflict inbox</h2>
      {items.map((item) => (
        <article key={`${item.entity_ref}-${item.field}`} className="rounded-xl border border-line bg-surface p-4">
          <p className="font-mono">{item.entity_ref} · {item.field}</p>
          <ul className="mt-2 text-sm">
            {item.observations.map((row) => (
              <li key={row.source_id}>{row.source_id}: {row.value}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-2">{item.policy}</p>
        </article>
      ))}
    </div>
  );
}
