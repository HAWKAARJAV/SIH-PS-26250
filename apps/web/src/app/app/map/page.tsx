"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api";

type Base = { id: string; name: string; lat: number; lon: number; status: string };

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [table, setTable] = useState<Base[]>([]);

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    api<{ items: Base[] }>("/api/v1/registers/bases")
      .then(async (data) => {
        if (cancelled) return;
        setTable(data.items);
        const maplibre = await import("maplibre-gl");
        if (!ref.current || cancelled) return;
        map = new maplibre.Map({
          container: ref.current,
          style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#F4EEE3" } }] },
          center: [65.5, 14.7],
          zoom: 6,
          attributionControl: false,
        });
        map.on("load", () => {
          data.items.forEach((base) => {
            const marker = document.createElement("button");
            marker.type = "button";
            marker.textContent = base.name;
            marker.className = "rounded-full bg-white px-2 py-1 text-xs";
            new maplibre.Marker({ element: marker }).setLngLat([base.lon, base.lat]).addTo(map!);
          });
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "The chart did not load."));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <section>
      <h1 className="font-display text-4xl">Theatre MERIDIAN</h1>
      <p className="mt-2 text-sm text-ink-3">Fictional chart. No external tiles.</p>
      {error && <p className="mt-3 text-brick">{error}</p>}
      <div ref={ref} className="mt-4 h-[480px] overflow-hidden rounded-xl border border-line" />
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Bases</caption>
        <thead><tr><th>Base</th><th>Status</th><th>Lat</th><th>Lon</th></tr></thead>
        <tbody>
          {table.map((base) => (
            <tr key={base.id} className="border-t border-line"><td>{base.name}</td><td>{base.status}</td><td className="font-mono">{base.lat}</td><td className="font-mono">{base.lon}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
