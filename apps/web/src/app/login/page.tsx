"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { api, setCsrf, type Me } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";

const ROLES = [
  ["commander", "Commander", "approves and publishes the plan"],
  ["planner", "Ops Planner", "optimises the day and submits a plan"],
  ["fleet", "Fleet Officer", "reads aircraft and stores"],
  ["crew_officer", "Crew Officer", "reads crew availability"],
  ["analyst", "Situation Analyst", "reads weather, airspace and threats"],
  ["auditor", "Auditor", "co-signs and verifies the audit chain"],
  ["admin", "Admin", "loads a scenario pack"],
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
    <main className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-6 py-10 md:grid-cols-2">
      <div>
        <p className="text-xs tracking-wide text-ember">{brand.disclaimer}</p>
        <h1 className="mt-4 font-display text-5xl">{brand.name}</h1>
        <p className="mt-3 text-ink-2">
          Sign in to the live demo. A planner optimises the flying day. A commander approves it.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-1)]">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void enter("/api/v1/auth/login", { email, password }, "Signing in with email and password…");
          }}
        >
          <label className="text-sm font-medium" htmlFor="login-email">
            Email address
            <input
              id="login-email"
              className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-normal"
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
              className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-normal"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="cursor-pointer rounded-lg bg-ember px-4 py-3 text-sm font-medium text-surface hover:bg-ember-hover disabled:cursor-wait disabled:opacity-70"
            type="submit"
            disabled={Boolean(pending)}
          >
            {pending && pending.startsWith("Signing in") ? pending : "Sign in with email and password"}
          </button>
        </form>
        <section className="mt-6" aria-live="polite">
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
            <div className="mt-3 grid gap-2">
              {ROLES.map(([role, label, duty]) => (
                <button
                  key={role}
                  className="cursor-pointer rounded-lg border border-line-strong bg-surface px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:cursor-wait disabled:opacity-70"
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void enter("/api/v1/auth/demo", { role }, `Opening the ${label} demo…`)}
                >
                  {pending === `Opening the ${label} demo…` ? pending : `Enter as ${label} — ${duty}`}
                </button>
              ))}
            </div>
          )}
        </section>
        {error && <p className="mt-3 text-sm text-brick" role="alert">{error}</p>}
      </div>
    </main>
  );
}
