"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { api, setCsrf, type Me } from "@/lib/api";

const ROLES = [
  ["commander", "Commander"],
  ["planner", "Ops Planner"],
  ["fleet", "Fleet Officer"],
  ["crew_officer", "Crew Officer"],
  ["analyst", "Situation Analyst"],
  ["auditor", "Auditor"],
  ["admin", "Admin"],
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState("commander@vyuha.local");
  const [password, setPassword] = useState("Vyuha-demo-2026");

  useEffect(() => {
    api<{ demo_mode: boolean }>("/api/v1/auth/config")
      .then((config) => setDemo(config.demo_mode))
      .catch(() => setDemo(false));
  }, []);

  async function enter(path: string, body: unknown) {
    setError("");
    try {
      const me = await api<Me>(path, { method: "POST", body: JSON.stringify(body) });
      setCsrf(me.csrf);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-6 py-10 md:grid-cols-2">
      <div>
        <p className="text-xs tracking-wide text-ember">{brand.disclaimer}</p>
        <h1 className="mt-4 font-display text-5xl">{brand.name}</h1>
        <p className="mt-3 text-ink-2">{brand.tagline}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-1)]">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void enter("/api/v1/auth/login", { email, password });
          }}
        >
          <label className="text-sm">Email
            <input className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="text-sm">Password
            <input className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="rounded-lg bg-ember px-4 py-3 text-surface" type="submit">Sign in</button>
        </form>
        {demo && (
        <div className="mt-6 grid gap-2">
          {ROLES.map(([role, label]) => (
            <button key={role} className="rounded-lg border border-line px-3 py-2 text-left text-sm" type="button" onClick={() => void enter("/api/v1/auth/demo", { role })}>
              Enter as {label}
            </button>
          ))}
        </div>
        )}
        {error && <p className="mt-3 text-sm text-brick" role="alert">{error}</p>}
      </div>
    </main>
  );
}
