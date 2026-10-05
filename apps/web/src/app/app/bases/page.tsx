"use client";

import { PageContext } from "@/components/page-context";
import { Register } from "@/components/register";

export default function BasesPage() {
  return (
    <section>
      <h1 className="font-display text-4xl">Bases</h1>
      <PageContext
        purpose="Airfield capacity and fuel state for theatre MERIDIAN. Launch and recovery rates are per 15-minute window — the optimiser uses them as hard caps."
        judgeLine="Same base rows power the map markers and the retask ‘close Bravo’ preset."
        actor="Scenario load sets base status; no inline editor on this screen."
        related={[{ href: "/app/map", label: "Map" }, { href: "/app/retask", label: "Retask" }]}
      />
      <Register
        kind="bases"
        emptyTitle="No bases"
        emptyDetail="No airfields are on the register. Load a scenario to see launch and recovery rates."
        columns={[
          { key: "id", label: "Base" },
          { key: "name", label: "Name" },
          { key: "status", label: "Status" },
          { key: "launch_rate_15m", label: "Launches per 15 min" },
          { key: "recovery_rate_15m", label: "Recoveries per 15 min" },
          { key: "fuel_state", label: "Fuel" },
        ]}
      />
    </section>
  );
}
