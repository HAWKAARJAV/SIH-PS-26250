"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { api, setCsrf, type Me } from "@/lib/api";
import { clockLine } from "@/lib/dtg";

const NAV = [
  { href: "/app", label: "Dashboard", group: "Command" },
  { href: "/app/plan", label: "Planner", group: "Plan" },
  { href: "/app/retask", label: "Retask", group: "Plan" },
  { href: "/app/missions", label: "Missions", group: "Plan" },
  { href: "/app/ato", label: "ATO", group: "Plan" },
  { href: "/app/fleet", label: "Fleet", group: "Resources" },
  { href: "/app/crew", label: "Crew", group: "Resources" },
  { href: "/app/stores", label: "Stores", group: "Resources" },
  { href: "/app/bases", label: "Bases", group: "Resources" },
  { href: "/app/fusion", label: "COP Health", group: "Intelligence" },
  { href: "/app/map", label: "Map", group: "Intelligence" },
  { href: "/app/audit", label: "Audit", group: "Governance" },
  { href: "/app/judge", label: "Judge mode", group: "Governance" },
  { href: "/app/admin", label: "Admin", group: "Governance" },
  { href: "/app/analytics", label: "Forecasts", group: "Intelligence" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [clock, setClock] = useState<{ pack: string; dtg: string; seed: number } | null>(null);
  const [zone, setZone] = useState<"Z" | "IST">("Z");
  const [health, setHealth] = useState<string>("");
  const [error, setError] = useState("");
  const showAdmin = me?.role === "admin" || me?.role === "commander";

  useEffect(() => {
    api<Me>("/api/v1/auth/me")
      .then((user) => {
        setCsrf(user.csrf);
        setMe(user);
      })
      .catch(() => router.replace("/login"));
    api<{ dtg: string; pack: string; seed: number }>("/api/v1/clock")
      .then((row) => setClock({ pack: row.pack, dtg: row.dtg, seed: row.seed }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Clock unavailable."));
    api<{ api: string; db: string; solver: string; fusion: string; audit: string }>("/api/v1/system/health")
      .then((row) => setHealth(`API ${row.api} · DB ${row.db} · SOLVER ${row.solver} · FUSION ${row.fusion} · AUDIT ${row.audit}`))
      .catch(() => setHealth(""));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [router]);

  return (
    <div className="min-h-screen">
      <p className="bg-ember-tint px-4 py-1 text-center text-xs tracking-wide text-ember">{brand.disclaimer}</p>
      <div className="flex">
        <aside className="hidden w-[248px] shrink-0 border-r border-line bg-surface p-4 md:block">
          <p className="font-display text-xl">{brand.name}</p>
          <nav className="mt-6 grid gap-4">
            {["Command", "Plan", "Resources", "Intelligence", "Governance"].map((group) => (
              <div key={group}>
                <p className="mb-1 text-xs uppercase tracking-wide text-ink-3">{group}</p>
                {NAV.filter((item) => item.group === group && (item.href !== "/app/admin" || showAdmin)).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-2 py-2 text-sm ${pathname === item.href ? "bg-ember-tint text-ember" : "text-ink-2"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between border-b border-line px-4">
            <div className="font-mono text-xs text-ink-2 md:text-sm">
              <p>{clock ? clockLine(clock.pack, clock.dtg, clock.seed, zone) : "Loading the clock…"}</p>
              {health && <p className="text-ink-3">{health}</p>}
            </div>
            <div className="flex items-center rounded-lg border border-line" role="group" aria-label="Clock zone">
              <button
                className={`px-2 py-1 text-xs ${zone === "Z" ? "bg-ember-tint text-ember" : "text-ink-2"}`}
                type="button"
                aria-pressed={zone === "Z"}
                onClick={() => setZone("Z")}
              >
                Zulu
              </button>
              <button
                className={`px-2 py-1 text-xs ${zone === "IST" ? "bg-ember-tint text-ember" : "text-ink-2"}`}
                type="button"
                aria-pressed={zone === "IST"}
                onClick={() => setZone("IST")}
              >
                IST
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(me?.role === "commander" || me?.role === "admin") && (
                <button
                  className="rounded border border-line px-2 py-1 text-xs"
                  type="button"
                  onClick={() => void api("/api/v1/clock", { method: "POST", body: JSON.stringify({ status: "RUNNING", rate: 10 }) })}
                >
                  Sim 10×
                </button>
              )}
              <p className="text-sm">{me ? `${me.display_name}` : "…"}</p>
            </div>
          </header>
          <div className="h-0.5 bg-gradient-to-r from-ember to-canvas" />
          <div className="mx-auto max-w-[1480px] p-4 md:p-6">
            {error && <p className="mb-4 rounded-lg bg-brick-tint px-3 py-2 text-sm text-brick">{error}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
