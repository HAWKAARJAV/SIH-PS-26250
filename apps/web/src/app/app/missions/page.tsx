"use client";
import { Register } from "@/components/register";
export default function MissionsPage() {
  return <section><h1 className="mb-4 font-display text-4xl">Missions</h1><Register kind="missions" columns={["id", "call_sign", "type", "priority", "value", "status", "launch_base"]} /></section>;
}
