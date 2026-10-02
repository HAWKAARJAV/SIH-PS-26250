"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function Register({ kind, columns }: { kind: string; columns: string[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ items: Record<string, unknown>[] }>(`/api/v1/registers/${kind}`)
      .then((data) => setRows(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The register did not load."));
  }, [kind]);
  if (error) return <p className="text-brick" role="alert">{error}</p>;
  if (!rows.length) return <p className="text-ink-3">Asking the ledger nicely…</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-ink-3">
          <tr>{columns.map((col) => <th key={col} className="p-2">{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, index) => (
            <tr key={String(row.id || row.tail || index)} className="border-t border-line">
              {columns.map((col) => (
                <td key={col} className="p-2 font-mono">{format(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function format(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
