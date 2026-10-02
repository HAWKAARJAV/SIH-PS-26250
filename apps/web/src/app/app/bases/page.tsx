"use client";
import { Register } from "@/components/register";
export default function BasesPage() {
  return <section><h1 className="mb-4 font-display text-4xl">Bases</h1><Register kind="bases" columns={["id", "name", "status", "launch_rate_15m", "recovery_rate_15m", "fuel_state"]} /></section>;
}
