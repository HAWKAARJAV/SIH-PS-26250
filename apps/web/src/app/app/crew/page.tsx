"use client";
import { Register } from "@/components/register";
export default function CrewPage() {
  return <section><h1 className="mb-4 font-display text-4xl">Crew</h1><Register kind="crew" columns={["id", "role", "base_id", "status", "hours_24h", "fatigue_index", "freshness"]} /></section>;
}
