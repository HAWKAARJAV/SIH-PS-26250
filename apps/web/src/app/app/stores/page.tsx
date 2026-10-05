"use client";

import { PageContext } from "@/components/page-context";
import { Register } from "@/components/register";

export default function StoresPage() {
  return (
    <section>
      <h1 className="font-display text-4xl">Stores</h1>
      <PageContext
        purpose="Munitions and load-out quantities per base. Reserve minimum is the floor the planner must not breach without explicit release."
        judgeLine="Quantities are seeded scenario data — not live supply chain feeds."
        actor="Fleet Officer updates stores in production; read-only here."
        related={[{ href: "/app/bases", label: "Bases" }, { href: "/app/fleet", label: "Fleet" }]}
      />
      <Register
        kind="stocks"
        emptyTitle="No stock rows"
        emptyDetail="No load-out quantities are on the register. Load a scenario to see stores by base."
        columns={[
          { key: "base_id", label: "Base" },
          { key: "code", label: "Stock code" },
          { key: "qty", label: "Quantity" },
          { key: "reserve_min", label: "Reserve minimum" },
          { key: "freshness", label: "Freshness" },
        ]}
      />
    </section>
  );
}
