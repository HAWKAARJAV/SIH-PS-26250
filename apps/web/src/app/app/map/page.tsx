"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { PageContext } from "@/components/page-context";
import { StatusBadge } from "@/components/states";
import { api } from "@/lib/api";

type Base = { id: string; name: string; lat: number; lon: number; status: string };
type Airspace = {
  id: string;
  polygon?: number[][];
  owner?: string;
  exclusive?: boolean;
  floor_ft?: number;
  ceiling_ft?: number;
  rules?: string;
};
type Threat = {
  id: string;
  kind?: string;
  lat?: number;
  lon?: number;
  radius_nm?: number;
  existence_p?: number;
  freshness?: string;
  restricted?: boolean;
};
type Pick =
  | { kind: "base"; base: Base }
  | { kind: "airspace"; item: Airspace }
  | { kind: "threat"; item: Threat };

type Layers = { land: boolean; airspace: boolean; threats: boolean; bases: boolean };

const THEATRE: [[number, number], [number, number]] = [
  [63.2, 12.55],
  [68.15, 16.65],
];

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const featureRef = useRef<{ source: string; id: string } | null>(null);
  const baseEls = useRef<HTMLButtonElement[]>([]);
  const [error, setError] = useState("");
  const [layerError, setLayerError] = useState("");
  const [table, setTable] = useState<Base[]>([]);
  const [counts, setCounts] = useState({ airspace: 0, threats: 0 });
  const [selected, setSelected] = useState<Pick | null>(null);
  const [layers, setLayers] = useState<Layers>({ land: true, airspace: true, threats: true, bases: true });
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState("");

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    api<{ items: Base[] }>("/api/v1/registers/bases")
      .then(async (data) => {
        if (cancelled) return;
        setTable(data.items);
        const maplibre = await import("maplibre-gl");
        if (!ref.current || cancelled) return;
        maplibre.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
        map = new maplibre.Map({
          container: ref.current,
          style: {
            version: 8,
            sources: {},
            layers: [{ id: "bg", type: "background", paint: { "background-color": "#c5d9ea" } }],
          },
          bounds: THEATRE,
          fitBoundsOptions: { padding: 28 },
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: true, visualizePitch: false }), "top-right");
        map.addControl(new maplibre.ScaleControl({ maxWidth: 110, unit: "nautical" }), "bottom-left");
        map.on("error", (event: { error?: { message?: string } }) => {
          if (cancelled) return;
          setLayerError(event.error?.message || "A chart layer failed.");
        });
        map.on("load", async () => {
          if (cancelled || !map) return;
          map.addSource("land", { type: "geojson", data: landmass() });
          map.addLayer({ id: "land-fill", type: "fill", source: "land", paint: { "fill-color": "#efe4d2" } });
          map.addLayer({
            id: "land-line",
            type: "line",
            source: "land",
            paint: { "line-color": "#8d7358", "line-width": 1.4 },
          });
          map.addSource("graticule", { type: "geojson", data: graticule() });
          map.addLayer({
            id: "graticule",
            type: "line",
            source: "graticule",
            filter: ["!=", ["get", "major"], true],
            paint: { "line-color": "#6f6352", "line-opacity": 0.18, "line-width": 0.6 },
          });
          map.addLayer({
            id: "graticule-major",
            type: "line",
            source: "graticule",
            filter: ["==", ["get", "major"], true],
            paint: { "line-color": "#51463a", "line-opacity": 0.28, "line-width": 0.8 },
          });
          const problems: string[] = [];
          let airspaceItems: Airspace[] = [];
          try {
            const airspace = await api<{ items: Airspace[] }>("/api/v1/registers/airspace");
            if (cancelled || !map) return;
            airspaceItems = airspace.items.filter((item) => item.polygon && item.polygon.length >= 3);
            map.addSource("airspace", { type: "geojson", data: polygons(airspaceItems) });
            map.addLayer({
              id: "airspace-fill",
              type: "fill",
              source: "airspace",
              paint: {
                "fill-color": ["match", ["get", "owner"], "civil", "#d9921a", "#365C87"],
                "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.38, 0.045],
              },
            });
            map.addLayer({
              id: "airspace-line",
              type: "line",
              source: "airspace",
              filter: ["!=", ["get", "exclusive"], true],
              paint: {
                "line-color": ["match", ["get", "owner"], "civil", "#8a5a12", "#2a4668"],
                "line-width": 1.25,
              },
            });
            map.addLayer({
              id: "airspace-line-ex",
              type: "line",
              source: "airspace",
              filter: ["==", ["get", "exclusive"], true],
              paint: {
                "line-color": "#2a2118",
                "line-width": 1.6,
                "line-dasharray": [1.4, 0.9],
              },
            });
          } catch (err) {
            problems.push(err instanceof Error ? `Airspace layer: ${err.message}` : "Airspace layer failed.");
          }

          let threatItems: Threat[] = [];
          try {
            const threats = await api<{ items: Threat[] }>("/api/v1/registers/threats");
            if (cancelled || !map) return;
            threatItems = threats.items.filter((item) => item.lat != null && item.lon != null && !item.restricted);
            map.addSource("threats", { type: "geojson", data: rings(threatItems) });
            map.addLayer({
              id: "threat-fill",
              type: "fill",
              source: "threats",
              paint: {
                "fill-color": "#A92D1B",
                "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.22, 0],
              },
            });
            map.addLayer({
              id: "threat-line",
              type: "line",
              source: "threats",
              paint: { "line-color": "#A92D1B", "line-width": 1.5, "line-dasharray": [2, 1.4] },
            });
          } catch (err) {
            problems.push(err instanceof Error ? `Threat layer: ${err.message}` : "Threat layer failed.");
          }

          if (!cancelled) {
            setCounts({ airspace: airspaceItems.length, threats: threatItems.length });
            if (problems.length) setLayerError(problems.join(" "));
          }

          data.items.forEach((base) => {
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "theatre-base flex flex-col items-center gap-1 border-0 bg-transparent p-0";
            marker.dataset.base = base.id;
            marker.setAttribute("aria-label", `Show ${base.name} on the chart`);
            const pill = document.createElement("span");
            pill.className =
              "rounded-full border border-line bg-surface/95 px-2.5 py-1 text-xs font-medium text-ink shadow-[var(--shadow-1)]";
            pill.textContent = base.name;
            const dot = document.createElement("span");
            dot.className = `size-2.5 rounded-full ring-2 ring-surface ${base.status === "OPEN" ? "bg-moss" : "bg-amber"}`;
            marker.append(pill, dot);
            marker.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              focusBase(base);
            });
            baseEls.current.push(marker);
            new maplibre.Marker({ element: marker, anchor: "bottom" }).setLngLat([base.lon, base.lat]).addTo(map!);
          });

          map.on("click", (event) => {
            const hits = map!.queryRenderedFeatures(event.point, { layers: presentLayers(map!) });
            const hit = hits[0];
            if (!hit) {
              clearFeature();
              setSelected(null);
              return;
            }
            const id = String(hit.properties?.id || hit.id || "");
            if (hit.source === "airspace") {
              const item = airspaceItems.find((block) => block.id === id);
              if (!item) return;
              paintSelection("airspace", id);
              setSelected({ kind: "airspace", item });
            } else if (hit.source === "threats") {
              const item = threatItems.find((threat) => threat.id === id);
              if (!item) return;
              paintSelection("threats", id);
              setSelected({ kind: "threat", item });
            }
          });
          map.on("mousemove", (event) => {
            const hits = map!.queryRenderedFeatures(event.point, { layers: presentLayers(map!) });
            const top = hits[0];
            const hint = top?.properties?.label ? String(top.properties.label) : "";
            map!.getCanvas().style.cursor = top ? "pointer" : "";
            setCursor(`${event.lngLat.lat.toFixed(2)}°N  ${event.lngLat.lng.toFixed(2)}°E${hint ? `  ·  ${hint}` : ""}`);
          });
          map.on("mouseleave", () => setCursor(""));
          if (!cancelled) setReady(true);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "The chart did not load.");
      });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      baseEls.current = [];
    };
    // focusBase and paintSelection close over the latest setters; the chart is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = (ids: string[], on: boolean) => {
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    };
    vis(["land-fill", "land-line", "graticule", "graticule-major"], layers.land);
    vis(["airspace-fill", "airspace-line", "airspace-line-ex"], layers.airspace);
    vis(["threat-fill", "threat-line"], layers.threats);
    for (const el of baseEls.current) el.style.display = layers.bases ? "" : "none";
  }, [layers, ready]);

  useEffect(() => {
    const id = selected?.kind === "base" ? selected.base.id : "";
    for (const el of baseEls.current) el.dataset.on = el.dataset.base === id ? "true" : "false";
  }, [selected, ready]);

  function paintSelection(source: string, id: string) {
    const map = mapRef.current;
    if (!map) return;
    if (featureRef.current) map.setFeatureState(featureRef.current, { selected: false });
    const next = { source, id };
    map.setFeatureState(next, { selected: true });
    featureRef.current = next;
  }

  function clearFeature() {
    const map = mapRef.current;
    if (map && featureRef.current) map.setFeatureState(featureRef.current, { selected: false });
    featureRef.current = null;
  }

  function focusBase(base: Base) {
    clearFeature();
    setSelected({ kind: "base", base });
    mapRef.current?.easeTo({ center: [base.lon, base.lat], duration: 450 });
  }

  function fitTheatre() {
    mapRef.current?.fitBounds(THEATRE, { padding: 28, duration: 450 });
  }

  return (
    <section>
      <h1 className="font-display text-4xl">Theatre MERIDIAN</h1>
      <PageContext
        purpose="Coastal chart of the fictional MERIDIAN theatre. Several airspace blocks share each base, and the threat rings cover the same water, so they cross. Hover or click one to read it."
        judgeLine="The coastline and grid are a synthetic chart drawn in the browser. No external map tiles, so the picture still loads offline."
        actor="Situation Analyst and all roles read the chart. Click a base, an airspace block, or a threat ring to read it."
        label={<StatusBadge tone="warn">SYNTHETIC THEATRE</StatusBadge>}
        related={[
          { href: "/app/bases", label: "Bases register" },
          { href: "/app/fusion", label: "COP Health" },
        ]}
      />
      {error && (
        <p className="mt-3 text-brick" role="alert">
          {error}
        </p>
      )}
      {layerError && (
        <p className="mt-3 text-brick" role="alert">
          {layerError}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <LayerToggle label="Coast" pressed={layers.land} onClick={() => setLayers((s) => ({ ...s, land: !s.land }))} />
        <LayerToggle label="Airspace" pressed={layers.airspace} onClick={() => setLayers((s) => ({ ...s, airspace: !s.airspace }))} />
        <LayerToggle label="Threat rings" pressed={layers.threats} onClick={() => setLayers((s) => ({ ...s, threats: !s.threats }))} />
        <LayerToggle label="Bases" pressed={layers.bases} onClick={() => setLayers((s) => ({ ...s, bases: !s.bases }))} />
        <button
          className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
          type="button"
          onClick={fitTheatre}
        >
          Fit theatre
        </button>
        <p className="text-xs text-ink-3">
          {table.length} bases · {counts.airspace} airspace blocks · {counts.threats} threat rings
        </p>
      </div>
      <div className="relative mt-3">
        <div
          ref={ref}
          className="theatre-chart h-[min(72vh,720px)] overflow-hidden rounded-2xl border border-line bg-[#c5d9ea] shadow-[var(--shadow-1)]"
          role="application"
          aria-label="Theatre MERIDIAN chart"
        />
        <p className="pointer-events-none absolute left-3 top-3 rounded-full border border-line bg-surface/90 px-2.5 py-1 font-mono text-[11px] text-ink-2">
          {cursor || "Move over the chart"}
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
        <Legend swatch="bg-[#efe4d2] border border-[#8d7358]" label="Land" />
        <Legend swatch="bg-vyom/30 border border-vyom" label="Military airspace" />
        <Legend swatch="bg-amber/40 border border-amber-text" label="Civil airspace" />
        <Legend swatch="border border-dashed border-ink" label="Exclusive block" />
        <Legend swatch="border border-dashed border-brick bg-brick/15" label="Threat ring" />
        <Legend swatch="bg-moss" label="Base open" />
      </ul>
      {selected?.kind === "base" && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">{selected.base.name}</h2>
          <p className="mt-2 text-sm">
            {selected.base.id} is a fictional base in theatre MERIDIAN. Status {selected.base.status}. Position{" "}
            {selected.base.lat.toFixed(2)}°N, {selected.base.lon.toFixed(2)}°E.
          </p>
        </article>
      )}
      {selected?.kind === "airspace" && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">{selected.item.id}</h2>
          <p className="mt-2 text-sm">
            {selected.item.owner === "civil" ? "Civil" : "Military"} airspace
            {selected.item.exclusive ? ", exclusive" : ""}. Floor {selected.item.floor_ft ?? "—"} ft, ceiling{" "}
            {selected.item.ceiling_ft ?? "—"} ft. Rules {selected.item.rules || "standard"}.
          </p>
        </article>
      )}
      {selected?.kind === "threat" && (
        <article className="mt-4 rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">{selected.item.id}</h2>
          <p className="mt-2 text-sm">
            {selected.item.kind || "Threat"} ring, radius {selected.item.radius_nm ?? "—"} nm
            {selected.item.existence_p != null ? `, existence ${(selected.item.existence_p * 100).toFixed(0)}%` : ""}. Freshness{" "}
            {selected.item.freshness || "—"}.
          </p>
        </article>
      )}
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Bases in the fictional theatre</caption>
        <thead>
          <tr>
            <th>Base</th>
            <th>Status</th>
            <th>Lat</th>
            <th>Lon</th>
          </tr>
        </thead>
        <tbody>
          {table.map((base) => {
            const on = selected?.kind === "base" && selected.base.id === base.id;
            return (
              <tr key={base.id} className={`border-t border-line ${on ? "bg-ember-tint/70" : ""}`}>
                <td>
                  <button className="py-1 text-left font-medium hover:text-ember" type="button" onClick={() => focusBase(base)}>
                    {base.name}
                  </button>
                </td>
                <td>{base.status}</td>
                <td className="font-mono">{base.lat}</td>
                <td className="font-mono">{base.lon}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function LayerToggle({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-2.5 py-1 text-xs ${pressed ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"}`}
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block size-3 rounded-sm ${swatch}`} aria-hidden="true" />
      {label}
    </li>
  );
}

function presentLayers(map: import("maplibre-gl").Map) {
  return ["threat-fill", "airspace-fill"].filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
}

function landmass() {
  const shapes: number[][][] = [
    [
      [60.4, 12.15],
      [64.35, 12.2],
      [64.72, 13.15],
      [64.4, 13.55],
      [64.85, 14.05],
      [64.48, 14.55],
      [64.9, 15.05],
      [64.42, 15.5],
      [64.78, 16.05],
      [64.2, 16.45],
      [60.4, 16.85],
      [60.4, 12.15],
    ],
    [
      [65.12, 15.12],
      [65.55, 15.02],
      [66.05, 15.18],
      [66.18, 15.48],
      [65.85, 15.82],
      [65.35, 15.78],
      [65.08, 15.48],
      [65.12, 15.12],
    ],
    [
      [65.42, 13.28],
      [65.95, 13.18],
      [66.38, 13.42],
      [66.28, 13.82],
      [65.72, 13.92],
      [65.38, 13.62],
      [65.42, 13.28],
    ],
    [
      [66.62, 14.58],
      [67.15, 14.48],
      [67.52, 14.72],
      [67.42, 15.08],
      [66.95, 15.18],
      [66.58, 14.88],
      [66.62, 14.58],
    ],
  ];
  return {
    type: "FeatureCollection" as const,
    features: shapes.map((ring) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    })),
  };
}

function graticule() {
  const features: { type: "Feature"; properties: { major: boolean }; geometry: { type: "LineString"; coordinates: number[][] } }[] = [];
  for (let lon = 63.5; lon <= 68; lon += 0.5) {
    features.push(line([[lon, 12.6], [lon, 16.6]], lon % 1 === 0));
  }
  for (let lat = 13; lat <= 16.5; lat += 0.5) {
    features.push(line([[63.25, lat], [68.1, lat]], lat % 1 === 0));
  }
  return { type: "FeatureCollection" as const, features };
}

function line(coordinates: number[][], major: boolean) {
  return {
    type: "Feature" as const,
    properties: { major },
    geometry: { type: "LineString" as const, coordinates },
  };
}

function polygons(items: Airspace[]) {
  return {
    type: "FeatureCollection" as const,
    features: [...items].sort((a, b) => span(b.polygon!) - span(a.polygon!)).map((item) => ({
      type: "Feature" as const,
      id: item.id,
      properties: {
        id: item.id,
        owner: item.owner || "military",
        exclusive: Boolean(item.exclusive),
        label: `${item.id} · ${item.owner || "military"}${item.exclusive ? " · exclusive" : ""}`,
      },
      geometry: { type: "Polygon" as const, coordinates: [item.polygon!.map(([lat, lon]) => [lon, lat])] },
    })),
  };
}

function rings(items: Threat[]) {
  return {
    type: "FeatureCollection" as const,
    features: [...items].sort((a, b) => (b.radius_nm ?? 0) - (a.radius_nm ?? 0)).map((item) => ({
      type: "Feature" as const,
      id: item.id,
      properties: {
        id: item.id,
        label: `${item.id} · ${item.kind || "threat"} · ${item.radius_nm ?? "?"} nm`,
      },
      geometry: { type: "Polygon" as const, coordinates: [circle(item.lon!, item.lat!, item.radius_nm ?? 10)] },
    })),
  };
}

function span(polygon: number[][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of polygon) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return (maxLat - minLat) * (maxLon - minLon);
}

function circle(lon: number, lat: number, radiusNm: number) {
  const points: number[][] = [];
  const dLat = radiusNm / 60;
  const dLon = radiusNm / (60 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  for (let index = 0; index <= 72; index += 1) {
    const angle = (index / 72) * Math.PI * 2;
    points.push([lon + Math.cos(angle) * dLon, lat + Math.sin(angle) * dLat]);
  }
  return points;
}
