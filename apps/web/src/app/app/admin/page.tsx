"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function AdminPage() {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pack, setPack] = useState("S5");

  async function load() {
    setError("");
    try {
      const result = await api<{ missions: number }>(`/api/v1/scenarios/load`, {
        method: "POST",
        body: JSON.stringify({ pack, seed: 26250, scale: "M" }),
      });
      setNote(`Loaded ${pack} · ${result.missions} missions · seed 26250.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Only admin or commander can load a scenario.");
    }
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Admin</h1>
      <p className="mt-2 text-sm text-ink-3">Scenario load is audited. It replaces the theatre and clears plans.</p>
      {note && <p className="mt-3 text-moss">{note}</p>}
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      <label className="mt-4 block text-sm">Pack
        <select className="mt-1 block rounded-lg border border-line-strong bg-surface px-3 py-2" value={pack} onChange={(e) => setPack(e.target.value)}>
          {["S1", "S2", "S3", "S4", "S5"].map((id) => <option key={id}>{id}</option>)}
        </select>
      </label>
      <button className="mt-4 rounded-lg bg-ember px-4 py-3 text-surface" type="button" onClick={() => void load()}>Load scenario</button>
    </section>
  );
}
