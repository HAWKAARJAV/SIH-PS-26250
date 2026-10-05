"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { PageContext } from "@/components/page-context";
import { StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Base = { id: string; name: string; lat: number; lon: number; status: string };

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [layerError, setLayerError] = useState("");
  const [table, setTable] = useState<Base[]>([]);
  const [selected, setSelected] = useState<Base | null>(null);

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
        map.on("error", (event: { error?: { message?: string } }) => {
          if (cancelled) return;
          setLayerError(event.error?.message || "A chart layer failed.");
        });
        map.on("load", async () => {
          if (cancelled || !map) return;
          const problems: string[] = [];
          try {
            const airspace = await api<{ items: { polygon?: number[][] }[] }>("/api/v1/registers/airspace");
            map.addSource("airspace", { type: "geojson", data: polygons(airspace.items) });
            map.addLayer({ id: "airspace-fill", type: "fill", source: "airspace", paint: { "fill-color": "#365C87", "fill-opacity": 0.15 } });
          } catch (err) {
            problems.push(err instanceof Error ? `Airspace layer: ${err.message}` : "Airspace layer failed.");
          }
          try {
            const threats = await api<{ items: { lat?: number; lon?: number; radius_nm?: number }[] }>("/api/v1/registers/threats");
            map.addSource("threats", { type: "geojson", data: rings(threats.items) });
            map.addLayer({ id: "threat-line", type: "line", source: "threats", paint: { "line-color": "#A92D1B", "line-width": 1.5, "line-dasharray": [2, 1] } });
          } catch (err) {
            problems.push(err instanceof Error ? `Threat layer: ${err.message}` : "Threat layer failed.");
          }
          if (!cancelled && problems.length) setLayerError(problems.join(" "));
          data.items.forEach((base) => {
            const marker = document.createElement("span");
            marker.textContent = base.name;
            marker.className = "rounded-full bg-white px-2 py-1 text-xs";
            marker.setAttribute("aria-label", `Show ${base.name}`);
            marker.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelected(base);
            });
            new maplibre.Marker({ element: marker }).setLngLat([base.lon, base.lat]).addTo(map!);
          });
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "The chart did not load.");
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <section>
      <h1 className="font-display text-4xl">Theatre MERIDIAN</h1>
      <PageContext
        purpose="Geographic picture of the fictional MERIDIAN theatre. Bases, airspace polygons, and threat rings are loaded from the same registers as the optimiser — rendered client-side with MapLibre."
        judgeLine="No external map tiles — flat background by design so the demo runs offline."
        actor="Situation Analyst and all roles read the chart. Click a base label to see its row details."
        label={<StatusBadge tone="warn">SYNTHETIC THEATRE</StatusBadge>}
        related={[{ href: "/app/bases", label: "Bases register" }, { href: "/app/fusion", label: "COP Health" }]}
      />
      {error && <p className="mt-3 text-brick" role="alert">{error}</p>}
      {layerError && <p className="mt-3 text-brick" role="alert">{layerError}</p>}
      <div ref={ref} className="mt-4 h-[480px] overflow-hidden rounded-xl border border-line" />
      {selected && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">{selected.name}</h2>
          <p className="mt-2 text-sm">
            {selected.id} is a fictional base in theatre MERIDIAN. Status {selected.status}. Position {selected.lat}, {selected.lon}.
          </p>
        </article>
      )}
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Bases in the fictional theatre</caption>
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
