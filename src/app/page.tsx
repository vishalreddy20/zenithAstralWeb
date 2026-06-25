"use client";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import TopBar from "@/components/TopBar";
import SidePanel from "@/components/SidePanel";
import LoadingScreen from "@/components/LoadingScreen";
import { CelestialData, SelectedLocation } from "@/lib/types";

const MapLibreGlobe = dynamic(() => import("@/components/MapLibreGlobe"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

const REFRESH_INTERVAL_MS = 10_000;

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [celestialData, setCelestialData] = useState<CelestialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [issLivePosition, setISSLivePosition] = useState<{ lat: number; lon: number } | null>(null);

  // Ref so the auto-refresh closure always reads latest location
  const locationRef = useRef<SelectedLocation | null>(null);
  locationRef.current = selectedLocation;

  // ── Core data fetch ─────────────────────────────────────────────────────────
  const fetchCelestialData = useCallback(
    async (location: SelectedLocation, showSpinner = true) => {
      if (showSpinner) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      try {
        const res = await fetch(
          `/api/celestial?lat=${location.lat}&lon=${location.lon}`
        );
        if (!res.ok) throw new Error("API error");
        const data: CelestialData = await res.json();
        setCelestialData(data);
      } catch (err) {
        console.error("Failed to fetch celestial data:", err);
      } finally {
        if (showSpinner) setLoading(false);
        else setIsRefreshing(false);
      }
    },
    []
  );

  // ── Initial fetch on location click / search ────────────────────────────────
  const handleLocationSelect = useCallback(
    async (location: SelectedLocation) => {
      setSelectedLocation(location);
      setCelestialData(null);
      await fetchCelestialData(location, true);
    },
    [fetchCelestialData]
  );

  // ── 10-second silent auto-refresh ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const loc = locationRef.current;
      if (loc) fetchCelestialData(loc, false);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCelestialData]);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* 3D Globe */}
      <MapLibreGlobe
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
        celestialData={celestialData}
        onReady={() => setGlobeReady(true)}
        onISSUpdate={(lat, lon) => setISSLivePosition({ lat, lon })}
      />

      {/* Top bar with search */}
      <TopBar
        selectedLocation={selectedLocation}
        globeReady={globeReady}
        onLocationSelect={handleLocationSelect}
      />

      {/* Side panel */}
      <SidePanel
        location={selectedLocation}
        data={celestialData}
        loading={loading}
        isRefreshing={isRefreshing}
        issLivePosition={issLivePosition}
      />

      {/* Click hint */}
      {!selectedLocation && globeReady && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="glass rounded-full px-6 py-3 flex items-center gap-3">
            <div className="pulse-dot" />
            <span className="text-sm font-mono text-cyan-300 tracking-widest">
              CLICK ANY POINT ON EARTH TO SCAN THE SKY
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
