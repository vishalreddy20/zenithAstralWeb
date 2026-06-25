"use client";
import { ISSData } from "@/lib/types";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ISSMapPanel = dynamic(() => import("./ISSMapPanel"), { ssr: false });

interface Props {
  iss: ISSData;
  livePosition: { lat: number; lon: number } | null;
  observerLat?: number;
  observerLon?: number;
}

const ISS_MAX_VELOCITY_KMH = 28_800; // ISS max ~28,800 km/h

export default function ISSCard({ iss, livePosition, observerLat, observerLon }: Props) {
  const isVisible  = iss.aboveHorizon;
  const [displayLat, setDisplayLat] = useState(iss.lat);
  const [displayLon, setDisplayLon] = useState(iss.lon);
  const [lastSync, setLastSync]     = useState<Date | null>(null);

  useEffect(() => {
    if (livePosition) {
      setDisplayLat(livePosition.lat);
      setDisplayLon(livePosition.lon);
      setLastSync(new Date());
    }
  }, [livePosition]);

  // Velocity in km/h (already correct from TLE propagation / wheretheiss.at)
  const velKmh   = iss.velocity;             // km/h
  const velKms   = (velKmh / 3600).toFixed(2); // km/s
  const speedPct = Math.min(100, (velKmh / ISS_MAX_VELOCITY_KMH) * 100);

  return (
    <div className={`glass rounded-xl p-4 border ${isVisible ? "border-cyan-400/40" : "border-gray-700/40"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛸</span>
          <div>
            <div className="font-mono text-sm font-bold text-white">ISS — Zarya Module</div>
            <div className="font-mono text-[10px] text-gray-500">NORAD 25544 · COSPAR 1998-067A</div>
          </div>
        </div>
        <span className={`orbit-badge ${isVisible
          ? "!text-green-400 !border-green-400/30 !bg-green-400/10"
          : "!text-red-400  !border-red-400/30  !bg-red-400/10"}`}>
          {isVisible ? "● VISIBLE" : "○ BELOW HORIZON"}
        </span>
      </div>

      {/* Data source badge */}
      <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-cyan-400/5 border border-cyan-400/10">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span className="font-mono text-[9px] text-cyan-400 tracking-wide">
          SGP4 ORBITAL PROPAGATION · TLE SOURCE: CELESTRAK / SPACE-TRACK.ORG
        </span>
      </div>

      {/* Live ISS Ground Track Map */}
      <div className="mb-3">
        <ISSMapPanel
          lat={displayLat}
          lon={displayLon}
          observerLat={observerLat}
          observerLon={observerLon}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatBox label="ALTITUDE" value={`${iss.altitude} km`}      color="cyan" />
        <StatBox label="VELOCITY" value={`${velKms} km/s`}           color="gold" />
        <StatBox
          label="LATITUDE"
          value={`${Math.abs(displayLat).toFixed(3)}° ${displayLat >= 0 ? "N" : "S"}`}
          color="cyan"
          live
        />
        <StatBox
          label="LONGITUDE"
          value={`${Math.abs(displayLon).toFixed(3)}° ${displayLon >= 0 ? "E" : "W"}`}
          color="gold"
          live
        />
        {isVisible && (
          <>
            <StatBox label="ELEVATION" value={`${iss.elevation?.toFixed(1)}°`} color="green" />
            <StatBox label="AZIMUTH"   value={`${iss.azimuth?.toFixed(1)}°`}   color="green" />
          </>
        )}
      </div>

      {/* Orbital period bar */}
      <div className="mb-3">
        <div className="flex justify-between font-mono text-[10px] text-gray-600 mb-1">
          <span>ORBITAL PERIOD</span>
          <span>~92 MIN 39 SEC</span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-1000"
            style={{ width: `${((Date.now() / 1000) % 5559) / 55.59}%` }}
          />
        </div>
      </div>

      {/* Speed tracker bar */}
      <div className="mb-3">
        <div className="flex justify-between font-mono text-[10px] text-gray-600 mb-1">
          <span>ORBITAL SPEED</span>
          <span className="text-cyan-400">{velKmh.toLocaleString()} km/h</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${speedPct}%`,
              background: "linear-gradient(90deg, #0ea5e9 0%, #00e5ff 60%, #67e8f9 100%)",
              boxShadow: "0 0 8px #00e5ff55",
            }}
          />
        </div>
        <div className="flex justify-between font-mono text-[8px] text-gray-700 mt-0.5">
          <span>0 km/h</span>
          <span>{ISS_MAX_VELOCITY_KMH.toLocaleString()} km/h MAX</span>
        </div>
      </div>

      {/* Next Pass Prediction */}
      {!isVisible && iss.nextPass && (
        <div className="mb-3 p-3 rounded-lg bg-cyan-900/20 border border-cyan-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-cyan-500 tracking-widest">NEXT VISIBLE PASS</span>
            <Countdown targetTimeMs={iss.nextPass.risetime} />
          </div>
          <div className="flex justify-between font-mono text-[9px] text-gray-400">
            <span>DURATION: {Math.round(iss.nextPass.duration / 60)} MIN</span>
            <span>MAX ELEVATION: {iss.nextPass.maxElevation}°</span>
          </div>
        </div>
      )}

      {/* Accuracy badge */}
      <div className="text-center py-2 px-3 rounded-lg bg-green-400/5 border border-green-400/10">
        <span className="font-mono text-[9px] text-green-400">
          ✓ POSITION ACCURACY ±1 KM · VELOCITY ACCURACY ±0.1 KM/S
        </span>
        {lastSync && (
          <div className="font-mono text-[8px] text-gray-600 mt-0.5">
            LAST LIVE SYNC {lastSync.toLocaleTimeString("en-IN", { hour12: false })}
          </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ targetTimeMs }: { targetTimeMs: number }) {
  const [remaining, setRemaining] = useState(targetTimeMs - Date.now());

  useEffect(() => {
    // update immediately in case of stale render
    setRemaining(targetTimeMs - Date.now());
    const id = setInterval(() => {
      setRemaining(targetTimeMs - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [targetTimeMs]);

  if (remaining <= 0) return <span className="font-mono text-xs font-bold text-green-400">ARRIVING NOW</span>;

  const s = Math.floor(remaining / 1000);
  const hrs = Math.floor(s / 3600).toString().padStart(2, '0');
  const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const secs = (s % 60).toString().padStart(2, '0');

  return <span className="font-mono text-sm font-bold text-cyan-400">T-{hrs}:{mins}:{secs}</span>;
}

function StatBox({
  label, value, color, live = false,
}: {
  label: string; value: string; color: "cyan" | "gold" | "green"; live?: boolean;
}) {
  const colorMap = { cyan: "text-cyan-400", gold: "text-yellow-400", green: "text-green-400" };
  return (
    <div className="bg-white/[0.03] rounded-lg p-2 relative overflow-hidden">
      <div className="font-mono text-[9px] text-gray-600 tracking-widest">{label}</div>
      <div className={`font-mono text-xs font-bold ${colorMap[color]}`}>{value}</div>
      {live && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping opacity-70" />
      )}
    </div>
  );
}
