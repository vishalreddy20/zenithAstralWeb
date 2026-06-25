"use client";
import { SatelliteData } from "@/lib/types";
import { useState } from "react";
import dynamic from "next/dynamic";

const SatelliteArcMap = dynamic(() => import("./SatelliteArcMap"), { ssr: false });

const MAX_VELOCITY_KMH = 28_800;

export default function SatelliteList({
  satellites,
  observerLat,
  observerLon,
}: {
  satellites: SatelliteData[];
  observerLat?: number;
  observerLon?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const above  = satellites.filter((s) => s.elevation > 0);
  const below  = satellites.filter((s) => s.elevation <= 0);
  const shown  = showAll ? satellites : satellites.slice(0, 8);

  if (satellites.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center space-y-2">
        <div className="text-3xl">🛰️</div>
        <div className="font-mono text-xs text-gray-500">COMPUTING SATELLITE POSITIONS...</div>
        <div className="font-mono text-[10px] text-gray-600">SGP4 propagation via embedded TLE data</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Arc map — shown when observer location is known */}
      {observerLat != null && observerLon != null && (
        <SatelliteArcMap
          satellites={satellites}
          observerLat={observerLat}
          observerLon={observerLon}
        />
      )}
      {/* Summary header */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] text-gray-400 tracking-widest">TRACKED OBJECTS</span>
          <span className="font-mono text-[9px] text-cyan-400">SGP4 · NORAD TLEs</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-400/5 border border-green-400/20 rounded-lg p-2 text-center">
            <div className="font-mono text-lg font-bold text-green-400">{above.length}</div>
            <div className="font-mono text-[8px] text-green-600">ABOVE HORIZON</div>
          </div>
          <div className="bg-gray-400/5 border border-gray-600/20 rounded-lg p-2 text-center">
            <div className="font-mono text-lg font-bold text-gray-400">{below.length}</div>
            <div className="font-mono text-[8px] text-gray-600">BELOW HORIZON</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[8px] text-gray-700 text-center">
          ✓ Positions computed via SGP4 orbital propagation from NORAD Two-Line Elements
        </div>
      </div>

      {/* Satellite cards */}
      {shown.map((sat, i) => <SatCard key={sat.noradId || i} sat={sat} />)}

      {satellites.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full glass rounded-xl p-2 font-mono text-[10px] text-gray-500 hover:text-cyan-400 transition-colors"
        >
          {showAll ? "▲ SHOW LESS" : `▼ SHOW ALL ${satellites.length} OBJECTS`}
        </button>
      )}
    </div>
  );
}

function SatCard({ sat }: { sat: SatelliteData }) {
  const isAbove  = sat.elevation > 0;
  const elevPct  = Math.min(100, (Math.max(0, sat.elevation) / 90) * 100);
  const speedPct = Math.min(100, (sat.velocity / MAX_VELOCITY_KMH) * 100);

  return (
    <div className={`glass rounded-xl p-3 border ${isAbove ? "border-purple-400/30" : "border-gray-700/20"}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-xs font-bold truncate ${isAbove ? "text-purple-300" : "text-gray-500"}`}>
            {sat.name}
          </div>
          <div className="font-mono text-[9px] text-gray-600">NORAD {sat.noradId || "—"}</div>
        </div>
        <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
          <span className={`orbit-badge ${isAbove
            ? "!text-green-400 !border-green-400/30 !bg-green-400/10"
            : "!text-gray-600 !border-gray-700/30 !bg-gray-800/30"} text-[8px]`}>
            {isAbove ? "● VISIBLE" : "○ BELOW"}
          </span>
          <span className="orbit-badge !text-purple-400 !border-purple-400/30 !bg-purple-400/10 text-[8px]">
            {sat.category}
          </span>
        </div>
      </div>

      {/* Elevation bar */}
      <div className="mb-1.5">
        <div className="flex justify-between font-mono text-[9px] text-gray-600 mb-1">
          <span>ELEVATION</span>
          <span className={isAbove ? "text-green-400" : "text-gray-600"}>{sat.elevation.toFixed(1)}°</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-700 to-purple-400 rounded-full"
            style={{ width: `${elevPct}%` }}
          />
        </div>
      </div>

      {/* Speed bar */}
      <div className="mb-2">
        <div className="flex justify-between font-mono text-[9px] text-gray-600 mb-1">
          <span>SPEED</span>
          <span className="text-purple-400">{sat.velocity.toLocaleString()} km/h</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${speedPct}%`,
              background: "linear-gradient(90deg, #7c3aed, #a855f7, #e040fb)",
              boxShadow: isAbove ? "0 0 4px #a855f744" : "none",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <MiniStat label="ALT" value={`${sat.altitude}km`} />
        <MiniStat label="AZ"  value={`${sat.azimuth.toFixed(0)}°`} />
        <MiniStat label="V"   value={`${(sat.velocity / 3600).toFixed(2)}km/s`} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded p-1.5 text-center">
      <div className="font-mono text-[8px] text-gray-600">{label}</div>
      <div className="font-mono text-[10px] text-gray-300 font-bold">{value}</div>
    </div>
  );
}
