"use client";
import { SelectedLocation, CelestialData } from "@/lib/types";
import ISSCard from "./ISSCard";
import SatelliteList from "./SatelliteList";
import PlanetList from "./PlanetList";
import ConstellationList from "./ConstellationList";
import { useState } from "react";

interface Props {
  location: SelectedLocation | null;
  data: CelestialData | null;
  loading: boolean;
  isRefreshing: boolean;
  issLivePosition: { lat: number; lon: number } | null;
}

type Tab = "iss" | "satellites" | "planets" | "constellations";

export default function SidePanel({
  location,
  data,
  loading,
  isRefreshing,
  issLivePosition,
}: Props) {
  const [tab, setTab] = useState<Tab>("iss");

  if (!location) return null;

  const visibleConstellations = data?.constellations.filter((c) => c.visible).length ?? 0;
  const visiblePlanets = data?.planets.filter((p) => p.aboveHorizon).length ?? 0;

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: "iss", label: "ISS", icon: "🛸" },
    { id: "satellites", label: "Sats", icon: "🛰️", count: data?.satellites.length },
    { id: "planets", label: "Planets", icon: "🪐", count: visiblePlanets },
    // Correctly shows only VISIBLE constellations (Upgrade 7 fix)
    { id: "constellations", label: "Stars", icon: "⭐", count: visibleConstellations },
  ];

  return (
    <div className="side-panel fixed top-20 right-4 bottom-4 z-20 w-80 flex flex-col gap-3">
      {/* Header */}
      <div className="glass rounded-xl p-4">
        {/* Mobile drag handle */}
        <div className="md:hidden w-8 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-yellow-400 tracking-widest">SKY SCAN</span>
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[10px] text-cyan-400">REFRESHING...</span>
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[10px] text-cyan-400">FETCHING...</span>
              </div>
            )}
            {data && !loading && !isRefreshing && (
              <span className="font-mono text-[10px] text-green-400">
                ✓ SYNCED {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour12: false })}
              </span>
            )}
          </div>
        </div>
        <div className="font-mono text-xs text-gray-400">
          {location.lat.toFixed(4)}° {location.lat >= 0 ? "N" : "S"}&nbsp;
          {Math.abs(location.lon).toFixed(4)}° {location.lon >= 0 ? "E" : "W"}
        </div>
      </div>

      {/* Skyplot — always shown when data available */}
      {data && <Skyplot data={data} />}

      {/* Tabs */}
      <div className="glass rounded-xl p-1.5 grid grid-cols-4 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg py-2 px-1 flex flex-col items-center gap-0.5 transition-all duration-200 ${
              tab === t.id
                ? "bg-cyan-400/10 border border-cyan-400/30"
                : "hover:bg-white/5"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className={`font-mono text-[9px] tracking-wide ${tab === t.id ? "text-cyan-400" : "text-gray-500"}`}>
              {t.label}
            </span>
            {t.count !== undefined && (
              <span className={`font-mono text-[8px] ${tab === t.id ? "text-cyan-300" : "text-gray-600"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {loading ? (
          <LoadingCards />
        ) : data ? (
          <>
            {tab === "iss" && (
              <ISSCard
                iss={data.iss}
                livePosition={issLivePosition}
                observerLat={location?.lat}
                observerLon={location?.lon}
              />
            )}
            {tab === "satellites" && (
              <SatelliteList
                satellites={data.satellites}
                observerLat={location?.lat}
                observerLon={location?.lon}
              />
            )}
            {tab === "planets" && <PlanetList planets={data.planets} />}
            {tab === "constellations" && (
              <ConstellationList constellations={data.constellations} />
            )}
          </>
        ) : (
          <div className="glass rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">🔭</div>
            <div className="font-mono text-xs text-gray-500">Awaiting data...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skyplot — SVG azimuth/altitude sky view ──────────────────────────────────
function Skyplot({ data }: { data: CelestialData }) {
  const cx = 80, cy = 80, r = 68;

  // Convert azimuth (0=N, 90=E) + altitude to x/y on the plot
  // Altitude 90° = center, 0° = edge circle
  const toXY = (az: number, alt: number) => {
    const rr = r * (1 - Math.max(0, alt) / 90);
    const azRad = ((az - 90) * Math.PI) / 180;
    return { x: cx + rr * Math.cos(azRad), y: cy + rr * Math.sin(azRad) };
  };

  // Collect visible objects
  const objects: { name: string; az: number; alt: number; color: string; symbol: string }[] = [
    ...(data.iss.aboveHorizon
      ? [{ name: "ISS", az: data.iss.azimuth, alt: data.iss.elevation, color: "#00e5ff", symbol: "🛸" }]
      : []),
    ...data.planets
      .filter((p) => p.aboveHorizon)
      .map((p) => ({ name: p.emoji, az: p.azimuth, alt: p.altitude, color: "#ffd700", symbol: p.emoji })),
    ...data.constellations
      .filter((c) => c.visible)
      .map((c) => ({ name: c.abbreviation, az: c.azimuth, alt: c.altitude, color: "#a78bfa", symbol: "★" })),
  ];

  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-cyan-400 tracking-widest">SKYVIEW</span>
        <span className="font-mono text-[9px] text-gray-600">{objects.length} OBJECTS OVERHEAD</span>
      </div>
      <div className="flex justify-center">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {/* Altitude rings */}
          <circle cx={cx} cy={cy} r={r} fill="rgba(0,229,255,0.03)" stroke="#00e5ff22" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={r * 2 / 3} fill="none" stroke="#00e5ff12" strokeWidth="0.5" strokeDasharray="4,4" />
          <circle cx={cx} cy={cy} r={r / 3} fill="none" stroke="#00e5ff12" strokeWidth="0.5" strokeDasharray="4,4" />
          {/* Cardinal crosshairs */}
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#00e5ff18" strokeWidth="0.5" />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#00e5ff18" strokeWidth="0.5" />
          {/* Cardinal labels */}
          <text x={cx} y={cy - r - 4} textAnchor="middle" fontSize="8" fill="#00e5ff88" fontFamily="monospace">N</text>
          <text x={cx + r + 4} y={cy + 3} textAnchor="start" fontSize="8" fill="#00e5ff88" fontFamily="monospace">E</text>
          <text x={cx} y={cy + r + 12} textAnchor="middle" fontSize="8" fill="#00e5ff88" fontFamily="monospace">S</text>
          <text x={cx - r - 4} y={cy + 3} textAnchor="end" fontSize="8" fill="#00e5ff88" fontFamily="monospace">W</text>
          {/* Zenith */}
          <circle cx={cx} cy={cy} r={2.5} fill="#00e5ff" opacity={0.4} />
          {/* Objects */}
          {objects.map((obj, i) => {
            const pos = toXY(obj.az, obj.alt);
            return (
              <g key={i}>
                <circle cx={pos.x} cy={pos.y} r={4} fill={obj.color} opacity={0.85} />
                <circle cx={pos.x} cy={pos.y} r={6} fill={obj.color} opacity={0.15} />
                <text
                  x={pos.x + 6}
                  y={pos.y + 3}
                  fontSize="7"
                  fill={obj.color}
                  fontFamily="monospace"
                  opacity={0.8}
                >
                  {obj.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-1">
        <span className="font-mono text-[8px] text-cyan-400">● ISS</span>
        <span className="font-mono text-[8px] text-yellow-400">● Planets</span>
        <span className="font-mono text-[8px] text-purple-400">● Stars</span>
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-xl p-4">
          <div className="shimmer h-4 w-3/4 rounded mb-2" />
          <div className="shimmer h-3 w-1/2 rounded mb-2" />
          <div className="shimmer h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  );
}
