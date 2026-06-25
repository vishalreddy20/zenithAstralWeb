"use client";
import { ConstellationData } from "@/lib/types";

export default function ConstellationList({ constellations }: { constellations: ConstellationData[] }) {
  const visible = constellations.filter((c) => c.visible);
  const notVisible = constellations.filter((c) => !c.visible);

  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] text-yellow-600 px-1 tracking-widest">
        {visible.length} CONSTELLATION{visible.length !== 1 ? "S" : ""} VISIBLE
      </div>
      {[...visible, ...notVisible].map((c) => (
        <div
          key={c.abbreviation}
          className={`celestial-card glass rounded-xl p-3 border border-transparent ${!c.visible && "opacity-40"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold border ${
                c.visible
                  ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                  : "border-gray-700 bg-gray-800 text-gray-600"
              }`}>
                {c.abbreviation.slice(0, 3)}
              </div>
              <div>
                <div className="font-mono text-xs font-bold text-white">{c.name}</div>
                <div className="font-mono text-[9px] text-gray-600">
                  {c.altitude.toFixed(1)}° · Az {c.azimuth.toFixed(0)}°
                </div>
              </div>
            </div>
            <span className={`orbit-badge ${
              c.visible
                ? "!text-yellow-400 !border-yellow-400/30 !bg-yellow-400/10"
                : "!text-gray-600 !border-gray-700"
            }`}>
              {c.visible ? "★ VISIBLE" : "BELOW"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
