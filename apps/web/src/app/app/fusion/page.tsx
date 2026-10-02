"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Source = { id: string; name: string; status?: string; degraded?: boolean; domain: string };

export default function FusionPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load() {
    api<{ items: Source[] }>("/api/v1/registers/sources")
      .then((data) => setSources(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Feeds did not load."));
  }
  useEffect(load, []);

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
      <p className="mt-2 text-sm text-ink-2">Eight feeds. A stale feed tightens the plan instead of being ignored.</p>
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      {note && <p className="mt-3 text-moss">{note}</p>}
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
            <div>
              <p className="font-mono">{source.id}</p>
              <p className="text-sm text-ink-2">{source.name}</p>
            </div>
            <button className="rounded-full border border-line px-3 py-1 text-sm" type="button" onClick={() => void degrade(source.id)}>
              {source.degraded ? "Restore" : "Degrade"} · {source.status || "LIVE"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
