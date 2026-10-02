"use client";
import { Register } from "@/components/register";
export default function FleetPage() {
  return <section><h1 className="mb-4 font-display text-4xl">Fleet</h1><Register kind="aircraft" columns={["tail", "type_id", "base_id", "status", "hours_to_inspection", "freshness"]} /></section>;
}
