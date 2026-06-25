"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import MapLibreGL from "maplibre-gl";
import {
  Map,
  MapArc,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  useMap,
} from "@/components/ui/map";
import type { MapArcDatum } from "@/components/ui/map";
import { SelectedLocation, CelestialData } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  onLocationSelect: (loc: SelectedLocation) => void;
  selectedLocation: SelectedLocation | null;
  celestialData: CelestialData | null;
  onReady: () => void;
  onISSUpdate: (lat: number, lon: number) => void;
}

interface ISSPosition {
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
}

interface OrbitArc extends MapArcDatum {
  segType: "orbit" | "track-fwd" | "track-past";
}

// ── Orbital ground track math ─────────────────────────────────────────────────
const ISS_INCLINATION = 51.64;
const ISS_PERIOD_MIN  = 92.65;
const EARTH_ROT_DEG   = 0.25; // deg/min

function issGroundPoint(lat: number, lon: number, minutesAhead: number) {
  const angRate  = 360 / ISS_PERIOD_MIN;
  const incRad   = (ISS_INCLINATION * Math.PI) / 180;
  const phase0   = Math.asin(Math.max(-1, Math.min(1, lat / ISS_INCLINATION)));
  const phase    = phase0 + ((minutesAhead * angRate) * Math.PI) / 180;
  const newLat   = ISS_INCLINATION * Math.sin(phase);
  const lonRate  = angRate / Math.cos(incRad);
  const dLon     = minutesAhead * lonRate - minutesAhead * EARTH_ROT_DEG;
  const newLon   = ((lon + dLon + 540) % 360) - 180;
  return { lat: newLat, lon: newLon };
}

function buildOrbitArcs(lat: number, lon: number): OrbitArc[] {
  const arcs: OrbitArc[] = [];
  const step = 3;

  // Future track — 92 min ahead (one full orbit)
  for (let i = 0; i < Math.floor(92 / step); i++) {
    const p0 = issGroundPoint(lat, lon, i * step);
    const p1 = issGroundPoint(lat, lon, (i + 1) * step);
    arcs.push({
      id: `fwd-${i}`,
      segType: "track-fwd",
      from: [p0.lon, p0.lat],
      to:   [p1.lon, p1.lat],
    });
  }

  // Past track — 20 min behind
  for (let i = 1; i <= Math.floor(20 / step); i++) {
    const p0 = issGroundPoint(lat, lon, -i * step);
    const p1 = issGroundPoint(lat, lon, -(i - 1) * step);
    arcs.push({
      id: `past-${i}`,
      segType: "track-past",
      from: [p0.lon, p0.lat],
      to:   [p1.lon, p1.lat],
    });
  }

  return arcs;
}

// ── Click handler (inner component uses useMap) ────────────────────────────────
function GlobeClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (loc: SelectedLocation) => void;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: MapLibreGL.MapMouseEvent) => {
      onLocationSelect({
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        timestamp: Date.now(),
      });
      // Animate globe to clicked point
      map.easeTo({
        center: [e.lngLat.lng, e.lngLat.lat],
        zoom: Math.max(map.getZoom(), 2),
        duration: 800,
      });
    };

    map.on("click", handleClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("click", handleClick);
    };
  }, [map, onLocationSelect]);

  return null;
}

// ── Map ref forwarder ─────────────────────────────────────────────────────────
function MapReadySignal({ onReady }: { onReady: () => void }) {
  const { map, isLoaded } = useMap();
  const calledRef = useRef(false);
  useEffect(() => {
    if (isLoaded && map && !calledRef.current) {
      calledRef.current = true;
      onReady();
    }
  }, [isLoaded, map, onReady]);
  return null;
}

// ── Main Globe component ──────────────────────────────────────────────────────
export default function MapLibreGlobe({
  onLocationSelect,
  selectedLocation,
  celestialData,
  onReady,
  onISSUpdate,
}: Props) {
  const [issPos, setIssPos] = useState<ISSPosition | null>(null);
  const issIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ISS live tracking
  useEffect(() => {
    const fetchISS = async () => {
      try {
        const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
        if (!res.ok) throw new Error("ISS API error");
        const d = await res.json();
        const pos: ISSPosition = {
          lat:      parseFloat(d.latitude),
          lon:      parseFloat(d.longitude),
          altitude: d.altitude ?? 408,
          velocity: Math.round((d.velocity ?? 7.66) * 3600),
        };
        setIssPos(pos);
        onISSUpdate(pos.lat, pos.lon);
      } catch {
        // silent fallback — data from API still available
      }
    };

    fetchISS();
    issIntervalRef.current = setInterval(fetchISS, 10_000);
    return () => {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
    };
  }, [onISSUpdate]);

  // Fly to selected location
  const handleMapReady = useCallback(() => {
    onReady();
  }, [onReady]);

  // Orbit arcs (memoized per ISS position)
  const orbitArcs = useMemo<OrbitArc[]>(
    () => (issPos ? buildOrbitArcs(issPos.lat, issPos.lon) : []),
    [issPos]
  );
  const futureArcs = useMemo(() => orbitArcs.filter((a) => a.segType === "track-fwd"), [orbitArcs]);
  const pastArcs   = useMemo(() => orbitArcs.filter((a) => a.segType === "track-past"), [orbitArcs]);

  // Satellite arcs from selected location
  const satArcs = useMemo(() => {
    if (!selectedLocation || !celestialData) return [];
    return celestialData.satellites.map((s) => ({
      id:   String(s.noradId),
      name: s.name,
      cat:  s.category,
      isAbove: s.elevation > 0,
      from: [selectedLocation.lon, selectedLocation.lat] as [number, number],
      to:   [s.lon, s.lat] as [number, number],
    }));
  }, [selectedLocation, celestialData]);

  return (
    <div
      id="cesium-container"
      style={{ position: "fixed", inset: 0, zIndex: 1 }}
    >
      <Map
        center={[78.96, 20.59]}
        zoom={2}
        theme="dark"
        projection={{ type: "globe" }}
        dragRotate={true}
        pitchWithRotate={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <MapReadySignal onReady={handleMapReady} />
        <GlobeClickHandler onLocationSelect={onLocationSelect} />

        {/* ── ISS past ground track ── */}
        {pastArcs.length > 0 && (
          <MapArc<OrbitArc>
            data={pastArcs}
            curvature={0.04}
            samples={24}
            interactive={false}
            paint={{
              "line-color": "#374151",
              "line-width": 1,
              "line-opacity": 0.5,
              "line-dasharray": [3, 4],
            }}
          />
        )}

        {/* ── ISS future ground track ── */}
        {futureArcs.length > 0 && (
          <MapArc<OrbitArc>
            data={futureArcs}
            curvature={0.04}
            samples={24}
            interactive={false}
            paint={{
              "line-color": "#00e5ff",
              "line-width": 1.5,
              "line-opacity": 0.55,
              "line-dasharray": [6, 3],
            }}
          />
        )}

        {/* ── Satellite arcs from observer (above horizon) ── */}
        {satArcs.filter((a) => a.isAbove).map((arc) => (
          <MapArc
            key={arc.id}
            data={[arc]}
            curvature={0.5}
            samples={32}
            interactive={false}
            paint={{
              "line-color": arc.cat === "Space Station" ? "#00e5ff"
                          : arc.cat === "Observatory"   ? "#ffd700"
                          : arc.cat === "Earth Obs."    ? "#34d399"
                          : "#a78bfa",
              "line-width": 0.8,
              "line-opacity": 0.35,
            }}
          />
        ))}

        {/* ── ISS marker ── */}
        {issPos && (
          <MapMarker longitude={issPos.lon} latitude={issPos.lat}>
            <MarkerContent>
              <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
                <div
                  className="absolute rounded-full border border-cyan-400 opacity-40 animate-ping"
                  style={{ width: 36, height: 36 }}
                />
                <div
                  className="absolute rounded-full bg-cyan-400/15"
                  style={{ width: 28, height: 28 }}
                />
                <span className="relative z-10 select-none" style={{ fontSize: 18 }}>🛸</span>
              </div>
            </MarkerContent>
            <MarkerLabel
              position="top"
              className="font-mono text-[9px] text-cyan-300 tracking-widest whitespace-nowrap"
            >
              ISS · {issPos.altitude.toFixed(0)} km
            </MarkerLabel>
          </MapMarker>
        )}

        {/* ── Satellite dots ── */}
        {celestialData?.satellites.map((sat) => (
          <MapMarker key={sat.noradId} longitude={sat.lon} latitude={sat.lat}>
            <MarkerContent>
              <div
                className="rounded-full border border-white/30"
                style={{
                  width:  sat.elevation > 0 ? 8 : 5,
                  height: sat.elevation > 0 ? 8 : 5,
                  background: sat.elevation > 0 ? "#a855f7" : "#44337a",
                  boxShadow: sat.elevation > 0 ? "0 0 5px #a855f7" : "none",
                }}
              />
            </MarkerContent>
            {sat.elevation > 0 && (
              <MarkerLabel
                position="top"
                className="font-mono text-[7px] text-purple-300 whitespace-nowrap"
              >
                {sat.name.length > 10 ? sat.name.slice(0, 10) + "…" : sat.name}
              </MarkerLabel>
            )}
          </MapMarker>
        ))}

        {/* ── Selected location marker ── */}
        {selectedLocation && (
          <MapMarker longitude={selectedLocation.lon} latitude={selectedLocation.lat}>
            <MarkerContent>
              <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                <div
                  className="absolute rounded-full border-2 border-yellow-400 animate-ping opacity-60"
                  style={{ width: 24, height: 24 }}
                />
                <div
                  className="w-3.5 h-3.5 rounded-full bg-yellow-400 border-2 border-white shadow-lg"
                  style={{ boxShadow: "0 0 10px #ffd700aa" }}
                />
              </div>
            </MarkerContent>
            <MarkerLabel
              position="top"
              className="font-mono text-[9px] text-yellow-300 whitespace-nowrap bg-black/60 px-1 rounded"
            >
              📍 {selectedLocation.lat.toFixed(2)}°,{selectedLocation.lon.toFixed(2)}°
            </MarkerLabel>
          </MapMarker>
        )}
      </Map>
    </div>
  );
}
