"use client";
import { PlanetData } from "@/lib/types";

const DIRECTION: Record<string, string> = {
  "0": "N", "45": "NE", "90": "E", "135": "SE",
  "180": "S", "225": "SW", "270": "W", "315": "NW",
};

function getCardinalDirection(azimuth: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(azimuth / 45) % 8];
}

export default function PlanetList({ planets }: { planets: PlanetData[] }) {
  const visible = planets.filter((p) => p.aboveHorizon);
  const notVisible = planets.filter((p) => !p.aboveHorizon);

  return (
    <div className="space-y-2">
      {/* Data method disclosure */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-yellow-400 tracking-widest">PLANETARY POSITIONS</span>
          <span className="font-mono text-[9px] text-gray-500">Keplerian Ephemeris</span>
        </div>
        <div className="font-mono text-[8px] text-gray-600 leading-relaxed">
          Computed via simplified Keplerian orbital elements (VSOP-lite).{" "}
          <span className="text-yellow-600">Accuracy: ±1–2°</span> — sufficient for naked-eye observation.
          For precision work, see JPL Horizons.
        </div>
        <div className="grid grid-cols-2 gap-1 mt-2">
          <div className="bg-green-400/5 border border-green-400/15 rounded p-1.5 text-center">
            <div className="font-mono text-sm font-bold text-green-400">{visible.length}</div>
            <div className="font-mono text-[8px] text-green-600">ABOVE HORIZON</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/30 rounded p-1.5 text-center">
            <div className="font-mono text-sm font-bold text-gray-500">{notVisible.length}</div>
            <div className="font-mono text-[8px] text-gray-600">BELOW HORIZON</div>
          </div>
        </div>
      </div>
      {[...visible, ...notVisible].map((planet) => (

        <div
          key={planet.name}
          className={`celestial-card glass rounded-xl p-3 border ${
            planet.aboveHorizon ? "border-transparent" : "border-transparent opacity-50"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{planet.emoji}</span>
              <div>
                <div className="font-mono text-xs font-bold text-white">{planet.name}</div>
                <div className="font-mono text-[9px] text-gray-600">
                  {planet.distance} AU · Mag {planet.magnitude}
                </div>
              </div>
            </div>
            <span className={`orbit-badge ${
              planet.aboveHorizon
                ? "!text-green-400 !border-green-400/30 !bg-green-400/10"
                : "!text-gray-600 !border-gray-700 !bg-gray-900"
            }`}>
              {planet.aboveHorizon ? "VISIBLE" : "BELOW"}
            </span>
          </div>

          {planet.aboveHorizon && (
            <>
              {/* Altitude arc */}
              <div className="mb-2">
                <div className="flex justify-between font-mono text-[9px] text-gray-600 mb-1">
                  <span>ALTITUDE</span>
                  <span className="text-cyan-400">{planet.altitude.toFixed(1)}° above horizon</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-700 to-cyan-400 rounded-full transition-all"
                    style={{ width: `${Math.max(2, (planet.altitude / 90) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/3 rounded p-1.5 text-center">
                  <div className="font-mono text-[8px] text-gray-600">DIRECTION</div>
                  <div className="font-mono text-xs text-cyan-400 font-bold">
                    {getCardinalDirection(planet.azimuth)} ({planet.azimuth.toFixed(0)}°)
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
