"use client";

import { useState } from "react";
import { Register } from "@/components/register";
import { api } from "@/lib/api";

export default function MissionsPage() {
  const [report, setReport] = useState("");
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setError("");
    const text = await file.text();
    let missions: unknown;
    try {
      const parsed = JSON.parse(text) as { missions?: unknown } | unknown[];
      missions = Array.isArray(parsed) ? parsed : parsed.missions;
    } catch {
      setError("That file is not JSON.");
      return;
    }
    if (!Array.isArray(missions)) {
      setError("JSON must be a list of missions or { missions: [] }.");
      return;
    }
    try {
      const result = await api<{ accepted: number; rejected: { row: string; reason: string }[] }>("/api/v1/missions/import", {
        method: "POST",
        body: JSON.stringify({ missions }),
      });
      setReport(`Accepted ${result.accepted}. Rejected ${result.rejected.length}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <section>
      <h1 className="mb-4 font-display text-4xl">Missions</h1>
      <label className="mb-4 block text-sm">
        Import JSON
        <input className="mt-1 block" type="file" accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }} />
      </label>
      {report && <p className="mb-3 text-moss">{report}</p>}
      {error && <p className="mb-3 text-brick" role="alert">{error}</p>}
      <Register kind="missions" columns={["id", "call_sign", "type", "priority", "value", "status", "launch_base"]} />
    </section>
  );
}
