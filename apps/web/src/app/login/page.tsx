"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { api, setCsrf, type Me } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

const ROLES = [
  ["commander", "Commander", "Approves and publishes the plan"],
  ["planner", "Ops Planner", "Optimises the day and submits a plan"],
  ["fleet", "Fleet Officer", "Reads aircraft and stores"],
  ["crew_officer", "Crew Officer", "Reads crew availability"],
  ["analyst", "Situation Analyst", "Reads weather, airspace and threats"],
  ["auditor", "Auditor", "Co-signs and verifies the audit chain"],
  ["admin", "Admin", "Loads a scenario pack"],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [configState, setConfigState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [configError, setConfigError] = useState("");
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState("commander@vyuha.local");
  const [password, setPassword] = useState("Vyuha-demo-2026");

  useEffect(() => {
    api<{ demo_mode?: boolean }>("/api/v1/auth/config")
      .then((config) => {
        if (typeof config.demo_mode !== "boolean") {
          setConfigState("empty");
          return;
        }
        setDemo(config.demo_mode);
        setConfigState("ready");
      })
      .catch((err: unknown) => {
        setConfigError(err instanceof Error ? err.message : "Sign-in options could not be loaded.");
        setConfigState("error");
      });
  }, []);

  async function enter(path: string, body: unknown, label: string) {
    setError("");
    setPending(label);
    try {
      const me = await api<Me>(path, { method: "POST", body: JSON.stringify(body) });
      setCsrf(me.csrf);
      const next = new URLSearchParams(window.location.search).get("next") || "";
      router.push(next.startsWith("/app") ? next : "/app");
    } catch (err) {
      setPending("");
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex flex-col justify-between bg-ink px-8 py-10 text-canvas lg:px-12">
        <p className="text-[11px] tracking-[0.16em] text-canvas/70">{brand.disclaimer}</p>
        <div className="py-12">
          <p className="text-sm text-ember">{brand.tagline}</p>
          <h1 className="mt-3 font-display text-6xl text-canvas">{brand.name}</h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-canvas/80">
            Sign in to the live demo. A planner optimises the flying day. A commander approves it.
          </p>
        </div>
        <p className="text-sm text-canvas/60">Fictional theatre MERIDIAN. Planning support only.</p>
      </section>
      <section className="flex items-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-xl">
          <form
            className="grid gap-3 rounded-[20px] border border-line bg-surface p-6 shadow-[var(--shadow-2)]"
            onSubmit={(event) => {
              event.preventDefault();
              void enter("/api/v1/auth/login", { email, password }, "Signing in with email and password…");
            }}
          >
            <label className="text-sm font-medium" htmlFor="login-email">
              Email address
              <input
                id="login-email"
                className="mt-1 w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 font-normal"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium" htmlFor="login-password">
              Password
              <input
                id="login-password"
                className="mt-1 w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 font-normal"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="rounded-full bg-ember px-4 py-3 text-sm font-medium text-surface hover:bg-ember-hover disabled:cursor-wait disabled:opacity-70"
              type="submit"
              disabled={Boolean(pending)}
            >
              {pending && pending.startsWith("Signing in") ? pending : "Sign in with email and password"}
            </button>
          </form>
          <section className="mt-8" aria-live="polite">
            <h2 className="text-sm font-medium">Demo roles</h2>
            {configState === "loading" && <LoadingState label="Checking whether demo sign-in is on…" />}
            {configState === "error" && <ErrorState message={configError} />}
            {configState === "empty" && (
              <EmptyState title="No demo roles returned" detail="The sign-in config did not say whether demo mode is on." />
            )}
            {configState === "ready" && !demo && (
              <EmptyState title="Demo role buttons are off" detail="This server is not in demo mode. Use the email and password above." />
            )}
            {configState === "ready" && demo && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ROLES.map(([role, label, duty]) => (
                  <button
                    key={role}
                    className="rounded-2xl border border-line bg-surface px-3 py-3 text-left hover:border-line-strong hover:bg-surface-2 disabled:cursor-wait disabled:opacity-70"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void enter("/api/v1/auth/demo", { role }, `Opening the ${label} demo…`)}
                  >
                    <span className="block text-sm font-medium">
                      {pending === `Opening the ${label} demo…` ? pending : `Enter as ${label}`}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-3">{duty}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          {error && (
            <p className="mt-3 text-sm text-brick" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
