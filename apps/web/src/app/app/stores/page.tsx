"use client";
import { Register } from "@/components/register";
export default function StoresPage() {
  return <section><h1 className="mb-4 font-display text-4xl">Stores</h1><Register kind="stocks" columns={["base_id", "code", "qty", "reserve_min", "freshness"]} /></section>;
}
