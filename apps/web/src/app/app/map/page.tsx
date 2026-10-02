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
        map.on("load", async () => {
          const airspace = await fetchJson<{ items: { polygon?: number[][] }[] }>("/api/v1/registers/airspace");
          const threats = await fetchJson<{ items: { lat?: number; lon?: number; radius_nm?: number }[] }>("/api/v1/registers/threats");
          map?.addSource("airspace", { type: "geojson", data: polygons(airspace.items) });
          map?.addLayer({ id: "airspace-fill", type: "fill", source: "airspace", paint: { "fill-color": "#365C87", "fill-opacity": 0.15 } });
          map?.addSource("threats", { type: "geojson", data: rings(threats.items) });
          map?.addLayer({ id: "threat-line", type: "line", source: "threats", paint: { "line-color": "#A92D1B", "line-width": 1.5, "line-dasharray": [2, 1] } });
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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) return { items: [] } as T;
  return response.json() as Promise<T>;
}

function polygons(items: { polygon?: number[][] }[]) {
  return {
    type: "FeatureCollection" as const,
    features: items.filter((item) => item.polygon).map((item) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [item.polygon!.map(([lat, lon]) => [lon, lat])] },
    })),
  };
}

function rings(items: { lat?: number; lon?: number; radius_nm?: number }[]) {
  return {
    type: "FeatureCollection" as const,
    features: items.filter((item) => item.lat != null && item.lon != null).map((item) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: circle(item.lon!, item.lat!, item.radius_nm ?? 10) },
    })),
  };
}

function circle(lon: number, lat: number, radiusNm: number) {
  const points = [];
  const dLat = radiusNm / 60;
  const dLon = radiusNm / (60 * Math.cos((lat * Math.PI) / 180));
  for (let index = 0; index <= 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    points.push([lon + Math.cos(angle) * dLon, lat + Math.sin(angle) * dLat]);
  }
  return points;
}
