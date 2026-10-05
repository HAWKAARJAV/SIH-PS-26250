"use client";

import { useEffect, useState } from "react";
import { PageContext } from "@/components/page-context";
import { ErrorState } from "@/components/states";
import { ApiError, api } from "@/lib/api";

export default function AdminPage() {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pack, setPack] = useState("S5");
  const [role, setRole] = useState("");
  const canLoad = role === "commander" || role === "admin";

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
  }, []);

  async function load() {
    setError("");
    try {
      const result = await api<{ missions: number }>(`/api/v1/scenarios/load`, {
        method: "POST",
        body: JSON.stringify({ pack, seed: 26250, scale: "M" }),
      });
      setNote(`Loaded ${pack} · ${result.missions} missions · seed 26250.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Only the commander or admin can load a scenario.";
      if (err instanceof ApiError && err.status === 403 && !/commander|admin/i.test(message)) {
        setError(`${message} Only the commander or admin can load a scenario.`);
        return;
      }
      setError(message);
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Admin</h1>
      <PageContext
        purpose="Load a scenario pack into the database. This wipes in-flight plans and re-seeds missions, fleet, and bases — every load is audited."
        judgeLine="Same load API as Judge mode RESET DEMO — Commander or Admin only."
        actor="Commander or Admin loads packs S1–S5. Planners see this page only if they type the URL."
        related={[{ href: "/app/judge", label: "Judge mode" }]}
      />
      {note && <p className="mt-3 text-moss">{note}</p>}
      {error && <ErrorState message={error} />}
      <label className="mt-4 block text-sm" htmlFor="scenario-pack">
        Scenario pack
        <select id="scenario-pack" className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={pack} onChange={(e) => setPack(e.target.value)}>
          {["S1", "S2", "S3", "S4", "S5"].map((id) => <option key={id}>{id}</option>)}
        </select>
      </label>
      <button
        className="mt-4 rounded-lg bg-ember px-4 py-3 text-surface disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={role !== "" && !canLoad}
        onClick={() => void load()}
      >
        Load scenario — replaces the theatre and clears plans
      </button>
      {role !== "" && !canLoad && (
        <p className="mt-2 text-xs text-ink-3">Only Commander or Admin can load. Switch role, or use Judge mode with the right account.</p>
      )}
    </section>
  );
}
