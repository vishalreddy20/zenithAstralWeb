"use client";
import { SelectedLocation } from "@/lib/types";
import { useState, useEffect, useRef, FormEvent } from "react";

interface Props {
  selectedLocation: SelectedLocation | null;
  globeReady: boolean;
  onLocationSelect: (loc: SelectedLocation) => void;
}

export default function TopBar({ selectedLocation, globeReady, onLocationSelect }: Props) {
  const [time, setTime] = useState("");
  const [utc, setUtc] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Live clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour12: false }));
      setUtc(now.toUTCString().split(" ")[4] + " UTC");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Nominatim geocoding search ──────────────────────────────────────────────
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearchError(false);
    setSearching(true);

    try {
      // Check for raw coordinate pair first: "lat, lon"
      const coordMatch = q.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          onLocationSelect({ lat, lon, name: q, timestamp: Date.now() });
          setQuery("");
          inputRef.current?.blur();
          return;
        }
      }

      // Nominatim free geocoding — no API key required
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        {
          headers: { "Accept-Language": "en" },
          signal: AbortSignal.timeout(8000),
        }
      );
      const data = await res.json();
      if (data?.[0]) {
        onLocationSelect({
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          name: data[0].display_name,
          timestamp: Date.now(),
        });
        setQuery("");
        inputRef.current?.blur();
      } else {
        setSearchError(true);
        setTimeout(() => setSearchError(false), 2500);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setSearchError(true);
      setTimeout(() => setSearchError(false), 2500);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="top-bar fixed top-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
      {/* Left: Logo */}
      <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 pointer-events-auto shrink-0">
        <div className="w-7 h-7 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
          <span className="text-sm">🌌</span>
        </div>
        <div>
          <div className="font-mono text-xs text-cyan-400 tracking-widest glow-cyan">PROJECT ZENITH</div>
          <div className="font-mono text-[10px] text-gray-500 tracking-wider">THE CELESTIAL EYE</div>
        </div>
      </div>

      {/* Center: Status + Search */}
      <div className="flex-1 flex flex-col items-center gap-1.5 pointer-events-auto max-w-md">
        {/* Status bar */}
        <div className="glass rounded-xl px-5 py-2 flex items-center gap-4 w-full justify-center">
          {globeReady ? (
            <>
              <div className="flex items-center gap-2">
                <div className="pulse-dot" />
                <span className="font-mono text-xs text-green-400 tracking-widest">LIVE</span>
              </div>
              <div className="w-px h-4 bg-gray-700" />
              {selectedLocation ? (
                <div className="font-mono text-xs text-gray-300 tracking-wider truncate">
                  <span className="text-cyan-400">{selectedLocation.lat.toFixed(4)}°N</span>
                  <span className="text-gray-600 mx-1">/</span>
                  <span className="text-cyan-400">{selectedLocation.lon.toFixed(4)}°E</span>
                </div>
              ) : (
                <span className="font-mono text-xs text-gray-500 tracking-wider">NO LOCATION SELECTED</span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-xs text-cyan-400 tracking-wider">INITIALIZING GLOBE...</span>
            </div>
          )}
        </div>

        {/* Search box */}
        {globeReady && (
          <form onSubmit={handleSearch} className="w-full">
            <div className={`glass rounded-lg flex items-center gap-2 px-3 py-1.5 border transition-all duration-200 ${
              searchError
                ? "border-red-500/50 bg-red-500/5"
                : "border-transparent focus-within:border-cyan-400/30"
            }`}>
              <span className="text-xs">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search city or "lat, lon" — e.g. Chennai or 13.08, 80.27'
                className="flex-1 bg-transparent font-mono text-[11px] text-gray-300 placeholder-gray-600 outline-none"
              />
              {searching ? (
                <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : searchError ? (
                <span className="font-mono text-[10px] text-red-400 shrink-0">NOT FOUND</span>
              ) : query ? (
                <button type="submit" className="font-mono text-[10px] text-cyan-400 hover:text-cyan-300 shrink-0 transition">
                  GO →
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>

      {/* Right: Time */}
      <div className="glass rounded-xl px-4 py-2.5 flex flex-col items-end pointer-events-auto shrink-0">
        <div className="font-mono text-sm text-white tracking-widest">{time}</div>
        <div className="font-mono text-[10px] text-gray-500 tracking-wider">{utc}</div>
      </div>
    </div>
  );
}
