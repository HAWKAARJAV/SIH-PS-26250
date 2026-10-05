"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { Register } from "@/components/register";
import { api } from "@/lib/api";

type Rejected = { row: string; reason: string };

export default function MissionsPage() {
  const [accepted, setAccepted] = useState<number | null>(null);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [role, setRole] = useState("");
  const canImport = role === "planner";

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
  }, []);

  async function onFile(file: File) {
    setError("");
    setAccepted(null);
    setRejected([]);
    const text = await file.text();
    const csv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
    try {
      const result = csv
        ? await api<{ accepted: number; rejected: Rejected[] }>("/api/v1/missions/import", {
            method: "POST",
            body: JSON.stringify({ format: "csv", csv: text }),
          })
        : await importJson(text);
      setAccepted(result.accepted);
      setRejected(result.rejected);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Missions</h1>
      <PageContext
        purpose="The authoritative list of requested sorties for the loaded scenario. Summary chips count rows by status and priority from the register API."
        judgeLine="Click a mission id to open why-not and risk — explanations come from the server, not static copy."
        actor="Ops Planner imports JSON or CSV. All other roles read and search only."
        related={[{ href: "/app/plan", label: "Planner" }, { href: "/app/retask", label: "Retask" }]}
      />
      <label className="mb-4 mt-2 block text-sm">
        Import mission JSON or CSV — Ops Planner
        <input
          className="mt-1 block disabled:cursor-not-allowed disabled:opacity-50"
          type="file"
          accept=".json,.csv,application/json,text/csv"
          disabled={role !== "" && !canImport}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>
      {role !== "" && !canImport && (
        <p className="mb-3 text-xs text-ink-3">Import stays closed for your role. Switch role to Ops Planner to upload a file.</p>
      )}
      {accepted !== null && (
        <p className="mb-3 text-moss" role="status">
          Accepted {accepted}. Rejected {rejected.length}.
        </p>
      )}
      {rejected.length > 0 && (
        <ul className="mb-3 grid gap-1 text-sm text-ink-2">
          {rejected.slice(0, 8).map((row) => (
            <li key={`${row.row}-${row.reason}`}>Row {row.row}: {row.reason}</li>
          ))}
        </ul>
      )}
      {error && <p className="mb-3 text-brick" role="alert">{error}</p>}
      <Register
        kind="missions"
        reloadKey={reloadKey}
        emptyTitle="No missions"
        emptyDetail="The scenario has no mission rows yet. Import JSON or CSV, or load a scenario."
        searchPlaceholder="Mission id, call sign, base…"
        columns={[
          { key: "id", label: "Mission", mono: true },
          { key: "call_sign", label: "Call sign", mono: true },
          { key: "type", label: "Type" },
          { key: "priority", label: "Priority" },
          { key: "value", label: "Value" },
          { key: "status", label: "Status" },
          { key: "launch_base", label: "Launch base", mono: true },
        ]}
      />
    </section>
  );
}

async function importJson(text: string) {
  let missions: unknown;
  try {
    const parsed = JSON.parse(text) as { missions?: unknown } | unknown[];
    missions = Array.isArray(parsed) ? parsed : parsed.missions;
  } catch {
    throw new Error("That file is not JSON or CSV.");
  }
  if (!Array.isArray(missions)) {
    throw new Error("JSON must be a list of missions or { missions: [] }.");
  }
  return api<{ accepted: number; rejected: Rejected[] }>("/api/v1/missions/import", {
    method: "POST",
    body: JSON.stringify({ missions }),
  });
}
