"use client";

import { PageContext } from "@/components/page-context";
import { Register } from "@/components/register";

export default function CrewPage() {
  return (
    <section>
      <h1 className="font-display text-4xl">Crew</h1>
      <PageContext
        purpose="Roster rows from the scenario: who is available, how many hours they flew in the last day, fatigue index, and data freshness."
        judgeLine="Freshness chips show how current each row is — stale crew rows tighten the optimiser like stale aircraft."
        actor="Crew Officer owns updates in a full deployment; this demo screen is read-only."
        related={[{ href: "/app/fleet", label: "Fleet" }, { href: "/app/plan", label: "Planner" }]}
      />
      <Register
        kind="crew"
        emptyTitle="No crew"
        emptyDetail="The roster is empty. Load a scenario to see people, duty hours, and fatigue."
        columns={[
          { key: "id", label: "Person", mono: true },
          { key: "role", label: "Role" },
          { key: "base_id", label: "Base", mono: true },
          { key: "status", label: "Status" },
          { key: "hours_24h", label: "Hours in 24h", unit: "h" },
          { key: "fatigue_index", label: "Fatigue" },
          { key: "freshness", label: "Freshness" },
        ]}
      />
    </section>
  );
}
