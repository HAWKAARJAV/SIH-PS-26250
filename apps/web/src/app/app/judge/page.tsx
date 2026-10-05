"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContext, SimulatedLabel } from "@/components/page-context";
import { ErrorState, LoadingState } from "@/components/states";
import { ApiError, api } from "@/lib/api";

const STEPS = [
  {
    title: "Reset demo",
    time: "0:00",
    click: "Press RESET DEMO. That reloads the theatre. START TOUR only returns this script to step 1.",
    success: "The status line says scenario S5 loaded, seed 26250, scale M, and the script moves to the baseline plan.",
    action: "reset" as const,
    openLabel: "RESET DEMO",
  },
  {
    title: "Baseline plan",
    time: "0:20",
    click: "Open the planner, then click Optimise, then Validate.",
    success: "The validator reads PASS and the Gantt shows the baseline order.",
    href: "/app/plan",
    openLabel: "Open planner",
  },
  {
    title: "COP health",
    time: "0:45",
    click: "Open COP health. Compare a fresh feed with a stale one, and open the conflict inbox.",
    success: "You can name which feed is fresh, which is stale, and what the conflict inbox is holding.",
    href: "/app/fusion",
    openLabel: "Open COP health",
  },
  {
    title: "Murphy event",
    time: "0:55",
    click: "Open retask and inject the disruption: close Bravo and mark T-114 NMC.",
    success: "The impact summary and the course-of-action cards are on the page.",
    href: "/app/retask",
    openLabel: "Open retask",
  },
  {
    title: "Command glance",
    time: "1:40",
    click: "Open the command glance.",
    success: "The page shows the COMMAND DECISION REQUIRED banner.",
    href: "/app",
    openLabel: "Open command glance",
  },
  {
    title: "Approve and publish",
    time: "2:10",
    click: "Open ATO. Ops Planner submits the draft, Commander approves, Auditor co-signs, Commander publishes.",
    success: "The order status is PUBLISHED and Download PDF saves the file.",
    href: "/app/ato",
    openLabel: "Open ATO",
  },
  {
    title: "Audit",
    time: "2:40",
    click: "Open audit and click Verify integrity.",
    success: "The badge reads PASS and the line says the chain is intact.",
    href: "/app/audit",
    openLabel: "Open audit",
  },
];

export default function JudgePage() {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const scene = STEPS[index];
  const canReset = role === "commander" || role === "admin";

  useEffect(() => {
    api<{ role: string }>("/api/v1/auth/me").then((me) => setRole(me.role)).catch(() => setRole(""));
  }, []);

  async function resetDemo() {
    setError("");
    setStatus("");
    setLoading(true);
    try {
      await api("/api/v1/scenarios/load", {
        method: "POST",
        body: JSON.stringify({ pack: "S5", seed: 26250, scale: "M" }),
      });
      setStatus("Scenario S5 loaded. Continue with baseline optimise.");
      setIndex(1);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error && err.message
          ? err.message
          : "Reset failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function startTour() {
    setError("");
    setIndex(0);
    setStatus("Tour started at step 1. START TOUR does not reload the theatre. RESET DEMO is the control that loads scenario S5.");
  }

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="font-display text-4xl">Judge mode</h1>
      <PageContext
        purpose="Step-by-step script for SIH demos. RESET loads scenario S5 (commander/admin). START TOUR only rewinds this checklist — it does not touch the server."
        judgeLine="Follow the timed steps; each link opens the real screen with live API data after reset."
        actor="Commander or Admin resets the theatre; any role can walk the tour read-only."
        label={<SimulatedLabel />}
        related={[{ href: "/docs", label: "Written judge notes" }, { href: "/login", label: "Switch role" }]}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg bg-ember px-4 py-3 text-surface disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canReset || loading} onClick={() => void resetDemo()}>
          Reset demo to scenario S5
        </button>
        <button className="rounded-lg border border-line-strong px-4 py-3" type="button" onClick={startTour}>
          START TOUR
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-3">
        Reset demo to scenario S5 replaces the theatre. A commander or an admin can press it. START TOUR only moves this script back to step 1.
        {role !== "" && !canReset && " You are signed in as a role that cannot load a scenario. Switch role to Commander or Admin."}
      </p>
      {loading && <LoadingState label="Loading judge scenario S5…" />}
      {error && <ErrorState message={error} onRetry={() => void resetDemo()} />}
      {!loading && !error && !status && (
        <p className="mt-3 text-sm text-ink-3" role="status">No scenario has been loaded in this tour yet.</p>
      )}
      {status && <p className="mt-3 text-sm text-ink-2">{status}</p>}
      <p className="mt-4 font-mono text-sm text-ink-3">Step {index + 1} of {STEPS.length} · {scene.time}</p>
      <article className="mt-4 rounded-xl border border-line bg-surface p-4">
        <p className="font-mono text-xs text-ink-3">{scene.time}</p>
        <h2 className="font-display text-2xl">{scene.title}</h2>
        <p className="mt-2"><span className="text-ink-3">Click. </span>{scene.click}</p>
        <p className="mt-2"><span className="text-ink-3">Success. </span>{scene.success}</p>
        {scene.action === "reset" ? (
          <button className="mt-4 rounded-lg bg-ember px-4 py-3 text-surface disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canReset || loading} onClick={() => void resetDemo()}>
            Reset demo to scenario S5
          </button>
        ) : (
          <Link className="mt-4 inline-block rounded-lg border border-line-strong px-4 py-3" href={scene.href!}>
            {scene.openLabel}
          </Link>
        )}
      </article>
      <div className="mt-4 flex gap-2">
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((v) => Math.max(0, v - 1))}>Back</button>
        <button className="rounded-lg border border-line px-3 py-2" type="button" onClick={() => setIndex((v) => Math.min(STEPS.length - 1, v + 1))}>Next</button>
      </div>
    </section>
  );
}
