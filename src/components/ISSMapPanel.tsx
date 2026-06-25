"use client";

import { useMemo, useState } from "react";
import {
  Map,
  MapArc,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MapPopup,
} from "@/components/ui/map";
import type { MapArcDatum } from "@/components/ui/map";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ISSMapPanelProps {
  lat: number;
  lon: number;
  observerLat?: number;
  observerLon?: number;
}

interface TrackArc extends MapArcDatum {
  segIndex: number;
  minutesAhead: number;
}

interface SightlineArc extends MapArcDatum {
  label: string;
}

// ── Ground track computation ──────────────────────────────────────────────────
// Approximates ISS ground track by advancing lat/lon using orbital mechanics.
// ISS: inclination ~51.64°, orbital period ~92.65 min, altitude ~420 km
const ISS_ORBITAL_PERIOD_MIN = 92.65;
const ISS_INCLINATION_DEG = 51.64;
const EARTH_ROTATION_DEG_PER_MIN = 0.25;
const TRACK_MINUTES = 92;      // one full orbit ahead
const TRACK_PAST_MINUTES = 20; // recent past to show
const SEGMENT_STEP_MIN = 4;

export function computeGroundTrack(
  currentLat: number,
  currentLon: number,
  minutesAhead: number,
): { lat: number; lon: number } {
  const angularRate = 360 / ISS_ORBITAL_PERIOD_MIN;
  const totalAngle = minutesAhead * angularRate;
  const incRad = (ISS_INCLINATION_DEG * Math.PI) / 180;

  const currentPhase = Math.asin(
    Math.max(-1, Math.min(1, currentLat / ISS_INCLINATION_DEG))
  );
  const newPhase = currentPhase + (totalAngle * Math.PI) / 180;
  const newLat = ISS_INCLINATION_DEG * Math.sin(newPhase);

  const cosPhase = Math.cos(newPhase);
  const lonRate = cosPhase !== 0 ? angularRate / Math.cos(incRad) : 0;
  const rawLonDelta = minutesAhead * lonRate - minutesAhead * EARTH_ROTATION_DEG_PER_MIN;
  const newLon = ((currentLon + rawLonDelta + 540) % 360) - 180;

  return { lat: newLat, lon: newLon };
}

function buildTrackArcs(issLat: number, issLon: number): TrackArc[] {
  const arcs: TrackArc[] = [];
  const steps = Math.floor(TRACK_MINUTES / SEGMENT_STEP_MIN);

  for (let i = 0; i < steps; i++) {
    const t0 = i * SEGMENT_STEP_MIN;
    const t1 = (i + 1) * SEGMENT_STEP_MIN;
    const p0 = computeGroundTrack(issLat, issLon, t0);
    const p1 = computeGroundTrack(issLat, issLon, t1);
    arcs.push({
      id: `track-fwd-${i}`,
      segIndex: i,
      minutesAhead: t0,
      from: [p0.lon, p0.lat],
      to: [p1.lon, p1.lat],
    });
  }

  const pastSteps = Math.floor(TRACK_PAST_MINUTES / SEGMENT_STEP_MIN);
  for (let i = 1; i <= pastSteps; i++) {
    const t0 = -i * SEGMENT_STEP_MIN;
    const t1 = -(i - 1) * SEGMENT_STEP_MIN;
    const p0 = computeGroundTrack(issLat, issLon, t0);
    const p1 = computeGroundTrack(issLat, issLon, t1);
    arcs.push({
      id: `track-past-${i}`,
      segIndex: -i,
      minutesAhead: t0,
      from: [p0.lon, p0.lat],
      to: [p1.lon, p1.lat],
    });
  }

  return arcs;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ISSMapPanel({ lat, lon, observerLat, observerLon }: ISSMapPanelProps) {
  const [hoveredSegment, setHoveredSegment] = useState<TrackArc | null>(null);
  const [popupPos, setPopupPos] = useState<{ longitude: number; latitude: number } | null>(null);

  const trackArcs = useMemo(() => buildTrackArcs(lat, lon), [lat, lon]);

  const sightlineArcs = useMemo<SightlineArc[]>(() => {
    if (observerLat == null || observerLon == null) return [];
    return [{
      id: "sightline",
      label: "Line of Sight",
      from: [observerLon, observerLat],
      to: [lon, lat],
    }];
  }, [observerLat, observerLon, lat, lon]);

  const hasObserver = observerLat != null && observerLon != null;
  const futureArcs  = trackArcs.filter((a) => a.segIndex >= 0);
  const pastArcs    = trackArcs.filter((a) => a.segIndex < 0);

  return (
    <div
      className="rounded-xl overflow-hidden border border-cyan-400/20 bg-black"
      style={{ height: "220px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/60 border-b border-cyan-400/10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-cyan-400 tracking-widest">
            ISS ORBITAL GROUND TRACK
          </span>
          {hoveredSegment && (
            <span className="font-mono text-[8px] text-yellow-400">
              T{hoveredSegment.minutesAhead >= 0 ? "+" : ""}{hoveredSegment.minutesAhead}min
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-cyan-400 rounded" />
            <span className="font-mono text-[7px] text-gray-500">AHEAD</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-gray-600 rounded" />
            <span className="font-mono text-[7px] text-gray-600">PAST</span>
          </div>
          {hasObserver && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-0.5 bg-purple-400/80 rounded" />
              <span className="font-mono text-[7px] text-purple-400">LOS</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-[8px] text-gray-500">
              {Math.abs(lat).toFixed(2)}°{lat >= 0 ? "N" : "S"}{" "}
              {Math.abs(lon).toFixed(2)}°{lon >= 0 ? "E" : "W"}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: "calc(100% - 34px)" }}>
        <Map
          center={[lon, lat]}
          zoom={1.4}
          theme="dark"
          scrollZoom={false}
          dragRotate={false}
          pitchWithRotate={false}
          attributionControl={false}
          className="h-full w-full"
        >
          {/* Past track — dashed gray */}
          <MapArc<TrackArc>
            data={pastArcs}
            curvature={0.05}
            samples={32}
            interactive={false}
            paint={{
              "line-color": "#4b5563",
              "line-width": 1,
              "line-opacity": 0.5,
              "line-dasharray": [3, 3],
            }}
          />

          {/* Future track — dashed cyan, highlights gold on hover */}
          <MapArc<TrackArc>
            data={futureArcs}
            curvature={0.05}
            samples={32}
            paint={{
              "line-color": "#00e5ff",
              "line-width": 1.5,
              "line-opacity": 0.7,
              "line-dasharray": [4, 2],
            }}
            hoverPaint={{
              "line-width": 3,
              "line-opacity": 1,
              "line-color": "#ffd700",
            }}
            onHover={(e) => {
              if (e) {
                setHoveredSegment(e.arc);
                setPopupPos({ longitude: e.longitude, latitude: e.latitude });
              } else {
                setHoveredSegment(null);
                setPopupPos(null);
              }
            }}
          />

          {/* Observer-to-ISS sightline arc */}
          {sightlineArcs.length > 0 && (
            <MapArc<SightlineArc>
              data={sightlineArcs}
              curvature={0.35}
              samples={48}
              interactive={false}
              paint={{
                "line-color": "#a855f7",
                "line-width": 1,
                "line-opacity": 0.6,
                "line-dasharray": [2, 4],
              }}
            />
          )}

          {/* Observer marker */}
          {hasObserver && (
            <MapMarker longitude={observerLon!} latitude={observerLat!}>
              <MarkerContent>
                <div className="relative flex items-center justify-center" style={{ width: 18, height: 18 }}>
                  <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white shadow-lg shadow-purple-500/50" />
                </div>
              </MarkerContent>
              <MarkerLabel position="bottom" className="font-mono text-[8px] text-purple-300 whitespace-nowrap">
                OBSERVER
              </MarkerLabel>
            </MapMarker>
          )}

          {/* ISS current position */}
          <MapMarker longitude={lon} latitude={lat}>
            <MarkerContent>
              <div className="relative flex items-center justify-center" style={{ width: 34, height: 34 }}>
                <div
                  className="absolute rounded-full border border-cyan-400 opacity-50 animate-ping"
                  style={{ width: 30, height: 30 }}
                />
                <div
                  className="absolute rounded-full bg-cyan-400/20"
                  style={{ width: 22, height: 22 }}
                />
                <span className="relative z-10 select-none" style={{ fontSize: 16, lineHeight: 1 }}>
                  🛸
                </span>
              </div>
            </MarkerContent>
            <MarkerLabel position="bottom" className="font-mono text-[8px] text-cyan-300 whitespace-nowrap">
              ISS NOW
            </MarkerLabel>
          </MapMarker>

          {/* Hover popup for future orbit segments */}
          {hoveredSegment && popupPos && (
            <MapPopup
              longitude={popupPos.longitude}
              latitude={popupPos.latitude}
              closeOnClick={false}
              className="p-0 !bg-transparent !border-none !shadow-none"
            >
              <div
                style={{
                  background: "rgba(2,4,10,0.92)",
                  border: "1px solid rgba(0,229,255,0.3)",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                <div className="font-mono text-[9px] text-cyan-400 tracking-widest">
                  T{hoveredSegment.minutesAhead >= 0 ? "+" : ""}{hoveredSegment.minutesAhead} MIN
                </div>
                <div className="font-mono text-[8px] text-gray-400">
                  {(() => {
                    const p = computeGroundTrack(lat, lon, hoveredSegment.minutesAhead);
                    return `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? "N" : "S"} ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? "E" : "W"}`;
                  })()}
                </div>
              </div>
            </MapPopup>
          )}
        </Map>
      </div>
    </div>
  );
}
