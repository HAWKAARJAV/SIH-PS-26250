"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Craft = { tail: string; type_id: string; base_id: string; status: string; version: number; hours_to_inspection: number };

export default function FleetPage() {
  const [rows, setRows] = useState<Craft[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function load() {
    api<{ items: Craft[] }>("/api/v1/registers/aircraft")
      .then((data) => setRows(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The fleet did not load."));
  }
  useEffect(load, []);

  async function save(row: Craft, status: string) {
    setError("");
    try {
      await api(`/api/v1/aircraft/${row.tail}`, {
        method: "PATCH",
        headers: { "If-Match": String(row.version) },
        body: JSON.stringify({ status, reason: "Updated from the fleet register." }),
      });
      setNote(`${row.tail} is ${status}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That status did not save.");
    }
  }

  return (
    <section>
      <h1 className="mb-4 font-display text-4xl">Fleet</h1>
      {note && <p className="mb-3 text-moss">{note}</p>}
      {error && <p className="mb-3 text-brick" role="alert">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-ink-3"><tr><th className="p-2">Tail</th><th>Type</th><th>Base</th><th>Hours to inspection</th><th>Status</th></tr></thead>
          <tbody>
            {rows.slice(0, 64).map((row) => (
              <tr key={row.tail} className="border-t border-line">
                <td className="p-2 font-mono">{row.tail}</td>
                <td className="font-mono">{row.type_id}</td>
                <td>{row.base_id}</td>
                <td className="font-mono">{row.hours_to_inspection}</td>
                <td>
                  <select className="rounded border border-line bg-surface px-2 py-1" value={row.status} onChange={(event) => void save(row, event.target.value)}>
                    <option>FMC</option>
                    <option>PMC</option>
                    <option>NMC</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
