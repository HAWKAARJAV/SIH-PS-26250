"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

export type RegisterColumn = {
  key: string;
  label: string;
  mono?: boolean;
  unit?: string;
};

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "neutral" | "info"> = {
  FMC: "ok",
  PMC: "warn",
  NMC: "bad",
  OPEN: "ok",
  CLOSED: "bad",
  READY: "ok",
  AVAILABLE: "ok",
  UNAVAILABLE: "bad",
  FRESH: "ok",
  STALE: "warn",
  DEGRADED: "warn",
  LIVE: "ok",
  P1: "bad",
  P2: "warn",
  P3: "neutral",
  SCHEDULED: "info",
  COMPLETE: "ok",
  CANCELLED: "neutral",
};

const CHIP_KEYS = new Set(["status", "freshness", "priority", "fuel_state"]);

export function Register({
  kind,
  columns,
  emptyTitle,
  emptyDetail,
  reloadKey = 0,
  searchPlaceholder,
  summaryKeys,
}: {
  kind: string;
  columns: RegisterColumn[];
  emptyTitle: string;
  emptyDetail: string;
  reloadKey?: number;
  searchPlaceholder?: string;
  summaryKeys?: string[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api<{ items: Record<string, unknown>[] }>(`/api/v1/registers/${kind}`)
      .then((data) => setRows(data.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The register did not load."))
      .finally(() => setLoading(false));
  }, [kind, reloadKey]);

  const keysForSearch = columns.map((col) => col.key);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      keysForSearch.some((key) => formatPlain(row[key]).toLowerCase().includes(needle)),
    );
  }, [rows, query, keysForSearch]);

  const summary = useMemo(() => buildSummary(rows, summaryKeys ?? ["status", "freshness", "priority", "fuel_state"]), [rows, summaryKeys]);

  if (loading) return <LoadingState label="Loading the register…" />;
  if (error) return <ErrorState message={error} />;
  if (!rows.length) return <EmptyState title={emptyTitle} detail={emptyDetail} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="status" aria-label="Register summary">
        <StatusBadge tone="neutral">{rows.length} rows loaded</StatusBadge>
        {summary.map((item) => (
          <StatusBadge key={`${item.key}-${item.value}`} tone={item.tone}>
            {item.value}: {item.count}
          </StatusBadge>
        ))}
        {query && (
          <StatusBadge tone="info">
            {filtered.length} matching “{query.trim()}”
          </StatusBadge>
        )}
      </div>
      <label className="block text-sm text-ink-2">
        Search this register
        <input
          className="mt-1 block w-full max-w-md rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink"
          type="search"
          placeholder={searchPlaceholder ?? "Filter by any column…"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-1)]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            {kind} register — showing {Math.min(filtered.length, 80)} of {filtered.length} rows
          </caption>
          <thead className="bg-surface-2/80 text-ink-3">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em]">
                  {col.label}
                  {col.unit ? <span className="ml-1 font-normal normal-case tracking-normal text-ink-3">({col.unit})</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 80).map((row, index) => (
              <tr key={String(row.id || row.tail || row.code || index)} className="border-t border-line hover:bg-canvas/80">
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2.5 ${col.mono ? "font-mono" : ""}`}>
                    {renderCell(col.key, row[col.key], row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 80 && (
          <p className="border-t border-line p-2 text-xs text-ink-3">
            Showing the first 80 of {filtered.length} rows. Narrow your search to find others.
          </p>
        )}
        {!filtered.length && (
          <p className="p-4 text-center text-sm text-ink-3">No rows match your search.</p>
        )}
      </div>
    </div>
  );
}

type BadgeTone = "ok" | "warn" | "bad" | "neutral" | "info";

function buildSummary(rows: Record<string, unknown>[], keys: string[]) {
  const out: { key: string; value: string; count: number; tone: BadgeTone }[] = [];
  for (const key of keys) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const raw = row[key];
      if (raw == null || raw === "") continue;
      const value = String(raw);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (counts.size === 0 || counts.size > 12) continue;
    for (const [value, count] of counts) {
      out.push({ key, value, count, tone: STATUS_TONE[value] ?? "neutral" });
    }
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 10);
}

function renderCell(key: string, value: unknown, row: Record<string, unknown>): ReactNode {
  if (key === "id" && kindLooksLikeMission(row)) {
    const id = String(value);
    return (
      <Link className="font-mono text-vyom underline decoration-vyom/30 underline-offset-2" href={`/app/missions/${id}`}>
        {id}
      </Link>
    );
  }
  if (CHIP_KEYS.has(key) || (typeof value === "string" && value in STATUS_TONE)) {
    const text = formatPlain(value);
    if (text === "—") return text;
    const tone = STATUS_TONE[text] ?? "neutral";
    return <StatusBadge tone={tone}>{text}</StatusBadge>;
  }
  return formatPlain(value);
}

function kindLooksLikeMission(row: Record<string, unknown>) {
  return "call_sign" in row || "launch_base" in row;
}

function formatPlain(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.map((item) => (typeof item === "object" ? formatObjectInline(item) : String(item))).join(", ");
  }
  if (typeof value === "object") return formatObjectInline(value as Record<string, unknown>);
  return String(value);
}

function formatObjectInline(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj)
    .filter(([, v]) => v != null && v !== "")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(" · ") : "—";
}
