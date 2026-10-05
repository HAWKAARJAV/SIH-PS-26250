"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CalendarRange,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LineChart,
  Map as MapIcon,
  Plane,
  ScrollText,
  Settings,
  Shuffle,
  SquareStack,
  Users,
  Warehouse,
  Flag,
} from "lucide-react";
import { brand } from "@/config/brand";
import { api, setCsrf, type Me } from "@/lib/api";
import { clockLine } from "@/lib/dtg";

const NAV = [
  { href: "/app", label: "Dashboard", subtitle: "Five-second command snapshot", group: "Command", icon: LayoutDashboard },
  { href: "/app/plan", label: "Planner", subtitle: "Optimise and validate the flying day", group: "Plan", icon: CalendarRange },
  { href: "/app/retask", label: "Retask", subtitle: "Inject disruption and pick a COA", group: "Plan", icon: Shuffle },
  { href: "/app/missions", label: "Missions", subtitle: "Requested sorties register", group: "Plan", icon: ClipboardList },
  { href: "/app/ato", label: "ATO", subtitle: "Submit, approve, publish the order", group: "Plan", icon: FileCheck2 },
  { href: "/app/fleet", label: "Fleet", subtitle: "Aircraft tails and FMC status", group: "Resources", icon: Plane },
  { href: "/app/crew", label: "Crew", subtitle: "Roster, duty, and fatigue", group: "Resources", icon: Users },
  { href: "/app/stores", label: "Stores", subtitle: "Load-out stock by base", group: "Resources", icon: SquareStack },
  { href: "/app/bases", label: "Bases", subtitle: "Launch and recovery rates", group: "Resources", icon: Warehouse },
  { href: "/app/fusion", label: "COP Health", subtitle: "Eight feeds and conflict inbox", group: "Intelligence", icon: Activity },
  { href: "/app/map", label: "Map", subtitle: "Theatre MERIDIAN picture", group: "Intelligence", icon: MapIcon },
  { href: "/app/analytics", label: "Forecasts", subtitle: "Simulated ML and Monte Carlo", group: "Intelligence", icon: LineChart },
  { href: "/app/audit", label: "Audit", subtitle: "Hash chain and verify", group: "Governance", icon: ScrollText },
  { href: "/app/judge", label: "Judge mode", subtitle: "Three-minute demo script", group: "Governance", icon: Flag },
  { href: "/app/admin", label: "Admin", subtitle: "Load scenario packs", group: "Governance", icon: Settings },
];

const GROUPS = ["Command", "Plan", "Resources", "Intelligence", "Governance"];

type Health = { api: string; db: string; solver: string; fusion: string; audit: string };

function isHere(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function tone(value: string) {
  const upper = value.toUpperCase();
  if (upper === "FAIL" || upper.startsWith("0/")) return "bg-brick";
  const ratio = /^(\d+)\/(\d+)$/.exec(value);
  if (ratio) return ratio[1] === ratio[2] && ratio[2] !== "0" ? "bg-moss" : "bg-amber";
  if (upper === "OK" || upper === "READY" || upper === "PASS") return "bg-moss";
  return "bg-amber";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [clock, setClock] = useState<{ pack: string; dtg: string; seed: number } | null>(null);
  const [zone, setZone] = useState<"Z" | "IST">("Z");
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [clockNote, setClockNote] = useState("");
  const showAdmin = me?.role === "admin" || me?.role === "commander";
  const items = NAV.filter((item) => item.href !== "/app/admin" || showAdmin);
  const current = items.find((item) => isHere(pathname, item.href));

  useEffect(() => {
    api<Me>("/api/v1/auth/me")
      .then((user) => {
        setCsrf(user.csrf);
        setMe(user);
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(pathnameRef.current || "/app")}`));
    api<{ dtg: string; pack: string; seed: number }>("/api/v1/clock")
      .then((row) => setClock({ pack: row.pack, dtg: row.dtg, seed: row.seed }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Clock unavailable."));
    api<Health>("/api/v1/system/health")
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith("vyuha-")) void caches.delete(key);
          }
        });
      }
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const nav = (
    <nav className="mt-6 grid gap-5" aria-label="Main">
      {GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{group}</p>
            {groupItems.map((item) => {
              const Icon = item.icon;
              const active = isHere(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.subtitle}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                    active ? "bg-ember-tint font-medium text-ember" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`}
                  onClick={() => setNavOpen(false)}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <p className="bg-ink px-4 py-1.5 text-center text-[11px] tracking-[0.16em] text-canvas">{brand.disclaimer}</p>
      <div className="flex">
        <aside className="sticky top-0 hidden h-[calc(100vh-28px)] w-[232px] shrink-0 flex-col border-r border-line bg-surface/80 px-3 py-5 backdrop-blur-md md:flex">
          <Link href="/app" className="flex items-center gap-2.5 px-2">
            <span className="grid size-8 place-items-center rounded-lg bg-ember font-display text-sm text-surface">V</span>
            <span>
              <span className="block font-display text-xl leading-none">{brand.name}</span>
              <span className="mt-1 block text-[11px] tracking-wide text-ink-3">Theatre MERIDIAN</span>
            </span>
          </Link>
          <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
          {current && <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-5 text-ink-2">{current.subtitle}</p>}
        </aside>
        {navOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-ink/40" type="button" aria-label="Close menu" onClick={() => setNavOpen(false)} />
            <aside className="relative flex h-full w-[min(100%,280px)] flex-col overflow-y-auto bg-surface p-4 shadow-[var(--shadow-2)]">
              <p className="font-display text-xl">{brand.name}</p>
              {nav}
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-md">
            <div className="flex h-14 items-center gap-3 px-4">
              <button
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs md:hidden"
                type="button"
                aria-expanded={navOpen}
                onClick={() => setNavOpen((open) => !open)}
              >
                {navOpen ? "Close menu" : "Open menu"}
              </button>
              <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2 md:text-sm">
                {clock ? clockLine(clock.pack, clock.dtg, clock.seed, zone) : "Loading the clock…"}
              </p>
              <div className="flex items-center rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Clock zone">
                <button
                  className={`rounded-full px-2.5 py-1 text-xs ${zone === "Z" ? "bg-ink text-canvas" : "text-ink-2"}`}
                  type="button"
                  title="Show the header clock in Zulu (Z)"
                  aria-pressed={zone === "Z"}
                  onClick={() => setZone("Z")}
                >
                  Zulu
                </button>
                <button
                  className={`rounded-full px-2.5 py-1 text-xs ${zone === "IST" ? "bg-ink text-canvas" : "text-ink-2"}`}
                  type="button"
                  title="Show the header clock in India Standard Time"
                  aria-pressed={zone === "IST"}
                  onClick={() => setZone("IST")}
                >
                  IST
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2.5">
              {health &&
                (
                  [
                    ["API", health.api],
                    ["DB", health.db],
                    ["Solver", health.solver],
                    ["Fusion", health.fusion],
                    ["Audit", health.audit],
                  ] as const
                ).map(([label, value]) => (
                  <span key={label} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-2">
                    <span className={`size-1.5 rounded-full ${tone(value)}`} aria-hidden="true" />
                    {label} {value}
                  </span>
                ))}
              {(me?.role === "commander" || me?.role === "admin") && (
                <button
                  className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-ink-2 hover:border-line-strong hover:text-ink"
                  type="button"
                  onClick={() => {
                    setClockNote("");
                    void api("/api/v1/clock", { method: "POST", body: JSON.stringify({ status: "RUNNING", rate: 10 }) })
                      .then(() => setClockNote("Simulation clock is running at 10×."))
                      .catch((err: unknown) => setClockNote(err instanceof Error ? err.message : "The simulation clock did not start."));
                  }}
                >
                  Run simulation clock at 10×
                </button>
              )}
              {clockNote && <p className="shrink-0 text-[11px] text-ink-2">{clockNote}</p>}
              <p className="ml-auto shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-ink">{me ? me.display_name : "…"}</p>
              <button
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                type="button"
                onClick={() => {
                  void api("/api/v1/auth/logout", { method: "POST" })
                    .catch(() => undefined)
                    .finally(() => {
                      setCsrf("");
                      router.push("/login");
                    });
                }}
              >
                Switch role
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-[1480px] p-4 md:p-8">
            {error && <p className="mb-4 rounded-xl bg-brick-tint px-3 py-2 text-sm text-brick">{error}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
