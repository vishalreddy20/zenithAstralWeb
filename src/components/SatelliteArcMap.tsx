"use client";

import { useMemo, useState } from "react";
import { SatelliteData } from "@/lib/types";
import type { MapArcDatum } from "@/components/ui/map";
import {
  Map,
  MapArc,
  MapMarker,
  MarkerContent,
  MapPopup,
} from "@/components/ui/map";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SatArc extends MapArcDatum {
  name: string;
  category: string;
  elevation: number;
  altitude: number;
  velocity: number;
  aboveHorizon: boolean;
}

interface SatelliteArcMapProps {
  satellites: SatelliteData[];
  observerLat: number;
  observerLon: number;
}

interface HoveredSat {
  arc: SatArc;
  popupLngLat: { longitude: number; latitude: number };
}

// ── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Space Station": "#00e5ff",
  "Observatory":   "#ffd700",
  "Earth Obs.":    "#34d399",
  "Satellite":     "#a78bfa",
};

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "#a78bfa";
}

const CATEGORIES = ["Space Station", "Observatory", "Earth Obs.", "Satellite"] as const;

// ── Main component ────────────────────────────────────────────────────────────
export default function SatelliteArcMap({ satellites, observerLat, observerLon }: SatelliteArcMapProps) {
  const [hovered, setHovered] = useState<HoveredSat | null>(null);
  const [showBelow, setShowBelow] = useState(false);

  const filtered = useMemo(
    () => showBelow ? satellites : satellites.filter((s) => s.elevation > 0),
    [satellites, showBelow]
  );

  // Build arcs from observer to each satellite
  const arcs = useMemo<SatArc[]>(
    () =>
      filtered.map((s) => ({
        id: String(s.noradId),
        name: s.name,
        category: s.category,
        elevation: s.elevation,
        altitude: s.altitude,
        velocity: s.velocity,
        aboveHorizon: s.elevation > 0,
        from: [observerLon, observerLat] as [number, number],
        to: [s.lon, s.lat] as [number, number],
      })),
    [filtered, observerLat, observerLon]
  );

  const aboveArcs = useMemo(() => arcs.filter((a) => a.aboveHorizon), [arcs]);
  const belowArcs = useMemo(() => arcs.filter((a) => !a.aboveHorizon), [arcs]);
  const aboveCount = satellites.filter((s) => s.elevation > 0).length;

  return (
    <div className="glass rounded-xl overflow-hidden border border-purple-400/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-400/10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-purple-400 tracking-widest">
            SATELLITE SIGNAL ARCS
          </span>
          {hovered && (
            <span className="font-mono text-[8px] text-cyan-400 truncate max-w-[100px]">
              → {hovered.arc.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowBelow((v) => !v)}
          className={`font-mono text-[8px] px-2 py-0.5 rounded border transition-colors ${
            showBelow
              ? "border-purple-400/40 text-purple-400 bg-purple-400/10"
              : "border-gray-700/40 text-gray-600 hover:text-gray-400"
          }`}
        >
          {showBelow ? "VISIBLE + BELOW" : `▲ ${aboveCount} VISIBLE`}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-b border-white/5">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1">
            <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
            <span className="font-mono text-[8px] text-gray-500">{cat}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ height: "200px" }}>
        <Map
          center={[observerLon, observerLat]}
          zoom={0.5}
          theme="dark"
          scrollZoom={false}
          dragRotate={false}
          pitchWithRotate={false}
          attributionControl={false}
          className="h-full w-full"
        >
          {/* Below-horizon arcs (faded, non-interactive) */}
          {showBelow && belowArcs.length > 0 && (
            <MapArc<SatArc>
              data={belowArcs}
              curvature={0.4}
              samples={32}
              interactive={false}
              paint={{
                "line-color": "#374151",
                "line-width": 0.8,
                "line-opacity": 0.3,
              }}
            />
          )}

          {/* Per-category arcs for above-horizon satellites */}
          {CATEGORIES.map((cat) => {
            const catArcs = aboveArcs.filter((a) => a.category === cat);
            if (catArcs.length === 0) return null;
            const color = getCategoryColor(cat);
            return (
              <MapArc<SatArc>
                key={cat}
                data={catArcs}
                curvature={0.35}
                samples={48}
                paint={{
                  "line-color": color,
                  "line-width": 1.5,
                  "line-opacity": 0.65,
                }}
                hoverPaint={{
                  "line-width": 3,
                  "line-opacity": 1,
                }}
                onHover={(e) => {
                  if (e) {
                    setHovered({
                      arc: e.arc,
                      popupLngLat: { longitude: e.longitude, latitude: e.latitude },
                    });
                  } else {
                    setHovered(null);
                  }
                }}
              />
            );
          })}

          {/* Observer marker */}
          <MapMarker longitude={observerLon} latitude={observerLat}>
            <MarkerContent>
              <div className="relative flex items-center justify-center" style={{ width: 20, height: 20 }}>
                <div
                  className="absolute rounded-full border border-purple-400/80 animate-ping opacity-70"
                  style={{ width: 16, height: 16 }}
                />
                <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white shadow-lg" />
              </div>
            </MarkerContent>
          </MapMarker>

          {/* Satellite dot markers */}
          {aboveArcs.map((arc) => (
            <MapMarker
              key={arc.id}
              longitude={arc.to[0]}
              latitude={arc.to[1]}
            >
              <MarkerContent>
                <div
                  className="rounded-full border border-white/50 shadow-sm"
                  style={{
                    width: 6,
                    height: 6,
                    background: getCategoryColor(arc.category),
                    boxShadow: `0 0 4px ${getCategoryColor(arc.category)}88`,
                  }}
                />
              </MarkerContent>
            </MapMarker>
          ))}

          {/* Hover popup */}
          {hovered && (
            <MapPopup
              longitude={hovered.popupLngLat.longitude}
              latitude={hovered.popupLngLat.latitude}
              closeOnClick={false}
              className="p-0 !bg-transparent !border-none !shadow-none"
            >
              <div
                style={{
                  background: "rgba(2,4,10,0.95)",
                  border: `1px solid ${getCategoryColor(hovered.arc.category)}55`,
                  borderRadius: 6,
                  padding: "5px 10px",
                  minWidth: 140,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: getCategoryColor(hovered.arc.category) }}
                  />
                  <span className="font-mono text-[9px] font-bold text-white truncate">
                    {hovered.arc.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <div>
                    <div className="font-mono text-[7px] text-gray-600">CATEGORY</div>
                    <div className="font-mono text-[8px]" style={{ color: getCategoryColor(hovered.arc.category) }}>
                      {hovered.arc.category}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[7px] text-gray-600">ELEVATION</div>
                    <div className="font-mono text-[8px] text-green-400">
                      {hovered.arc.elevation.toFixed(1)}°
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[7px] text-gray-600">ALTITUDE</div>
                    <div className="font-mono text-[8px] text-cyan-400">
                      {hovered.arc.altitude} km
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[7px] text-gray-600">SPEED</div>
                    <div className="font-mono text-[8px] text-yellow-400">
                      {(hovered.arc.velocity / 3600).toFixed(1)} km/s
                    </div>
                  </div>
                </div>
              </div>
            </MapPopup>
          )}
        </Map>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[8px] text-green-400">
            ● {aboveCount} ABOVE HORIZON
          </span>
          <span className="font-mono text-[8px] text-gray-600">
            ○ {satellites.length - aboveCount} BELOW
          </span>
        </div>
        <span className="font-mono text-[7px] text-gray-700">HOVER ARC TO INSPECT</span>
      </div>
    </div>
  );
}
