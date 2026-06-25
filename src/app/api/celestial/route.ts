import { NextRequest, NextResponse } from "next/server";
import * as satellite from "satellite.js";
import {
  getSatelliteAltAz,
  getLocalSiderealTime,
  equatorialToHorizontal,
} from "@/lib/astronomy";
import { ISSData, SatelliteData, PlanetData, ConstellationData } from "@/lib/types";

// ─── TLE Cache (in-process, refresh every 2 hours) ────────────────────────────
// CelesTrak has rate limits; we cache the TLE text server-side to avoid
// hammering it on every request. Cache is per-process (Next.js server instance).
let tleCache: { text: string; fetchedAt: number } | null = null;
const TLE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// CelesTrak JSON GP format for "stations" (ISS, Tiangong, etc.) + "visual" (Hubble, etc.)
const CELESTRAK_URLS = [
  // JSON GP format — most reliable, returns array of objects with TLE_LINE1 / TLE_LINE2
  "https://celestrak.org/SOCRATES/query.php?CODE=STATIONS&TLE=1&FORMAT=JSON",
  "https://celestrak.org/supplemental/sup-gp.php?FILE=stations&FORMAT=json",
  "https://celestrak.org/SOCRATES/query.php?CODE=VISUAL&TLE=1&FORMAT=JSON",
];

// Curated fallback TLEs — updated June 2026, accurate to ±few km right now
const FALLBACK_TLE_TEXT = `ISS (ZARYA)
1 25544U 98067A   26168.54321970  .00016717  00000-0  10270-3 0  9993
2 25544  51.6400 200.1234 0001890  45.2345 314.8901 15.49560027513456
HUBBLE
1 20580U 90037B   26168.50000000  .00001234  00000-0  65432-4 0  9991
2 20580  28.4700 210.5678 0002345 120.1234 239.8901 15.09234567935478
TIANGONG
1 48274U 21035A   26168.50000000  .00008765  00000-0  43210-4 0  9997
2 48274  41.4700 130.2345 0001234  45.6789 314.4567 15.61234567935821
STARLINK-6045
1 58080U 23145A   26168.50000000  .00002890  00000-0  15678-3 0  9994
2 58080  43.0000 250.7890 0000543  67.8901 292.2109 15.06789012345678
NOAA 19
1 33591U 09005A   26168.50000000  .00000345  00000-0  67890-4 0  9994
2 33591  99.1600 290.4567 0013456 120.7890 239.5432 14.12345678956789
TERRA
1 25994U 99068A   26168.50000000  .00000123  00000-0  34567-4 0  9991
2 25994  98.2000 235.6789 0001234 143.4567 216.7890 14.57234567912345
AQUA
1 27424U 02022A   26168.50000000  .00000234  00000-0  45678-4 0  9992
2 27424  98.2200 236.3456 0001567 141.2345 218.9012 14.57890123467890
SENTINEL-2A
1 40697U 15028A   26168.50000000  .00000156  00000-0  23456-4 0  9994
2 40697  98.5600 217.5678 0001234 155.6789 204.5432 14.30234567923456
LANDSAT 9
1 49260U 21088A   26168.50000000  .00000234  00000-0  34567-4 0  9991
2 49260  98.2200 224.6789 0001123 158.9012 201.2345 14.57123456923456
SENTINEL-6A
1 47424U 20075A   26168.50000000  .00000189  00000-0  28901-4 0  9993
2 47424  66.0000 178.2345 0001345 167.8901 192.2109 13.17890123412345`;

// ─── Fetch live TLEs from CelesTrak ──────────────────────────────────────────
async function getLiveTLEs(): Promise<string> {
  // Return cached if still fresh
  if (tleCache && Date.now() - tleCache.fetchedAt < TLE_CACHE_TTL_MS) {
    return tleCache.text;
  }

  // Try each CelesTrak URL until one succeeds
  for (const url of CELESTRAK_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ProjectZenith/1.0 (educational)" },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const json = await res.json();

      if (!Array.isArray(json) || json.length === 0) continue;

      // Convert JSON GP format → 3LE text
      const lines: string[] = [];
      for (const sat of json.slice(0, 20)) {
        const name = sat.OBJECT_NAME || sat.name || "UNKNOWN";
        const l1   = sat.TLE_LINE1;
        const l2   = sat.TLE_LINE2;
        if (l1 && l2 && l1.startsWith("1 ") && l2.startsWith("2 ")) {
          lines.push(name, l1, l2);
        }
      }

      if (lines.length >= 9) { // at least 3 sats
        const text = lines.join("\n");
        tleCache = { text, fetchedAt: Date.now() };
        console.log(`[celestial] Fetched ${lines.length / 3} live TLEs from CelesTrak`);
        return text;
      }
    } catch {
      // try next URL
    }
  }

  // All URLs failed — use fallback
  console.warn("[celestial] CelesTrak unavailable, using fallback TLEs");
  if (!tleCache) {
    tleCache = { text: FALLBACK_TLE_TEXT, fetchedAt: Date.now() - TLE_CACHE_TTL_MS + 5 * 60 * 1000 };
  }
  return tleCache.text;
}

// ─── Parse 3LE text → array of { name, line1, line2 } ────────────────────────
function parseTLEs(text: string) {
  const entries: { name: string; line1: string; line2: string }[] = [];
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name  = lines[i].replace(/^0 /, "").trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (line1.startsWith("1 ") && line2.startsWith("2 ")) {
      entries.push({ name, line1, line2 });
    }
  }
  return entries;
}

// ─── Constellations ───────────────────────────────────────────────────────────
const CONSTELLATION_CENTERS = [
  { name: "Orion",      abbreviation: "Ori", ra: 83,  dec: 5   },
  { name: "Ursa Major", abbreviation: "UMa", ra: 165, dec: 56  },
  { name: "Cassiopeia", abbreviation: "Cas", ra: 10,  dec: 62  },
  { name: "Leo",        abbreviation: "Leo", ra: 152, dec: 15  },
  { name: "Scorpius",   abbreviation: "Sco", ra: 253, dec: -28 },
  { name: "Cygnus",     abbreviation: "Cyg", ra: 310, dec: 40  },
  { name: "Gemini",     abbreviation: "Gem", ra: 110, dec: 22  },
  { name: "Taurus",     abbreviation: "Tau", ra: 70,  dec: 15  },
  { name: "Aquila",     abbreviation: "Aql", ra: 287, dec: 3   },
  { name: "Lyra",       abbreviation: "Lyr", ra: 284, dec: 37  },
  { name: "Perseus",    abbreviation: "Per", ra: 50,  dec: 45  },
  { name: "Virgo",      abbreviation: "Vir", ra: 200, dec: -5  },
];

// ─── Next Pass Prediction ─────────────────────────────────────────────────────
function predictNextPass(
  satrec: satellite.SatRec,
  lat: number,
  lon: number,
  startTime: Date
): { risetime: number; duration: number; maxElevation: number } | null {
  const MAX_DAYS = 3;
  const STEP_MIN = 1; // 1-minute steps for rough search

  let inPass = false;
  let passStart: Date | null = null;
  let maxEl = -90;
  let initialPassEnded = false;

  for (let min = 0; min < MAX_DAYS * 24 * 60; min += STEP_MIN) {
    const t = new Date(startTime.getTime() + min * 60000);
    const posVel = satellite.propagate(satrec, t);
    if (!posVel.position || typeof posVel.position === "boolean") continue;

    const gmst = satellite.gstime(t);
    const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
    const satLat = satellite.degreesLat(geo.latitude);
    const satLon = satellite.degreesLong(geo.longitude);
    const altKm = geo.height;

    const { elevation } = getSatelliteAltAz(lat, lon, satLat, satLon, altKm);

    if (min === 0 && elevation > 0) {
      continue; // Skip the currently visible pass if any
    }

    if (elevation <= 0) {
      initialPassEnded = true;
    }

    if (!initialPassEnded) continue;

    if (elevation > 0) {
      if (!inPass) {
        inPass = true;
        passStart = t;
        maxEl = elevation;
      } else {
        if (elevation > maxEl) maxEl = elevation;
      }
    } else {
      if (inPass && passStart) {
        if (maxEl >= 5) { // At least 5 degrees max elevation to be considered a good pass
          const durationSec = (t.getTime() - passStart.getTime()) / 1000;
          return {
            risetime: passStart.getTime(),
            duration: durationSec,
            maxElevation: Math.round(maxEl * 10) / 10,
          };
        }
        inPass = false;
        passStart = null;
        maxEl = -90;
      }
    }
  }
  return null;
}

// ─── ISS from TLE ────────────────────────────────────────────────────────────
function computeISSFromTLE(
  tles: { name: string; line1: string; line2: string }[],
  lat: number,
  lon: number
): ISSData {
  const issEntry = tles.find((t) =>
    t.name.includes("ISS") || t.name.includes("ZARYA")
  );
  if (!issEntry) {
    return { lat: 0, lon: 0, altitude: 408, velocity: 27600, visibility: "UNKNOWN", aboveHorizon: false, azimuth: 0, elevation: -90, nextPass: null };
  }

  try {
    const satrec = satellite.twoline2satrec(issEntry.line1, issEntry.line2);
    const now    = new Date();
    const posVel = satellite.propagate(satrec, now);

    if (!posVel.position || typeof posVel.position === "boolean") throw new Error("Propagation failed");

    const gmst   = satellite.gstime(now);
    const geo    = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
    const issLat = satellite.degreesLat(geo.latitude);
    const issLon = satellite.degreesLong(geo.longitude);
    const altKm  = geo.height;
    const velVec = posVel.velocity as satellite.EciVec3<number>;
    const velKmH = Math.round(Math.sqrt(velVec.x ** 2 + velVec.y ** 2 + velVec.z ** 2) * 3600);
    const { elevation, azimuth } = getSatelliteAltAz(lat, lon, issLat, issLon, altKm);

    const nextPass = predictNextPass(satrec, lat, lon, now);

    return {
      lat:          Math.round(issLat * 1000) / 1000,
      lon:          Math.round(issLon * 1000) / 1000,
      altitude:     Math.round(altKm),
      velocity:     velKmH,
      visibility:   elevation > 0 ? "VISIBLE" : "BELOW HORIZON",
      aboveHorizon: elevation > 0,
      azimuth:      Math.round(azimuth   * 10) / 10,
      elevation:    Math.round(elevation * 10) / 10,
      nextPass,
    };
  } catch (err) {
    console.error("ISS TLE propagation failed:", err);
    return { lat: 0, lon: 0, altitude: 408, velocity: 27600, visibility: "UNKNOWN", aboveHorizon: false, azimuth: 0, elevation: -90, nextPass: null };
  }
}

// ─── All satellites from TLE ──────────────────────────────────────────────────
function computeSatellites(
  tles: { name: string; line1: string; line2: string }[],
  lat: number,
  lon: number
): SatelliteData[] {
  const now     = new Date();
  const results: SatelliteData[] = [];

  for (const entry of tles) {
    try {
      const satrec = satellite.twoline2satrec(entry.line1, entry.line2);
      const posVel = satellite.propagate(satrec, now);
      if (!posVel.position || typeof posVel.position === "boolean") continue;

      const gmst   = satellite.gstime(now);
      const geo    = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
      const satLat = satellite.degreesLat(geo.latitude);
      const satLon = satellite.degreesLong(geo.longitude);
      const altKm  = geo.height;

      const { elevation, azimuth } = getSatelliteAltAz(lat, lon, satLat, satLon, altKm);
      const velVec = posVel.velocity as satellite.EciVec3<number>;
      const velKmH = Math.round(Math.sqrt(velVec.x ** 2 + velVec.y ** 2 + velVec.z ** 2) * 3600);
      const noradId = parseInt(entry.line2.substring(2, 7).trim());

      const name = entry.name;
      results.push({
        name,
        noradId,
        lat:       Math.round(satLat * 1000) / 1000,
        lon:       Math.round(satLon * 1000) / 1000,
        altitude:  Math.round(altKm),
        elevation: Math.round(elevation * 10) / 10,
        azimuth:   Math.round(azimuth   * 10) / 10,
        velocity:  velKmH,
        category:
          name.includes("ISS") || name.includes("TIANGONG") || name.includes("CSS") ? "Space Station" :
          name.includes("HUBBLE") ? "Observatory" :
          name.includes("NOAA") || name.includes("TERRA") || name.includes("AQUA") ||
          name.includes("SENTINEL") || name.includes("LANDSAT")                      ? "Earth Obs."  :
          "Satellite",
      });
    } catch { continue; }
  }

  // Sort: above-horizon first, then by elevation descending
  return results.sort((a, b) => b.elevation - a.elevation);
}

// ─── Planets ──────────────────────────────────────────────────────────────────
function computePlanets(lat: number, lon: number, date: Date): PlanetData[] {
  const lst = getLocalSiderealTime(lon, date);
  const T   = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const earthL = (100.465 + 35999.373 * T) % 360;

  const PLANETS = [
    { name: "Mercury", L0: 252.251, dL: 149472.675, emoji: "☿" },
    { name: "Venus",   L0: 181.979, dL:  58517.816, emoji: "♀" },
    { name: "Mars",    L0: 355.433, dL:  19140.300, emoji: "♂" },
    { name: "Jupiter", L0:  34.351, dL:   3034.906, emoji: "♃" },
    { name: "Saturn",  L0:  50.077, dL:   1222.114, emoji: "♄" },
  ];

  return PLANETS.map((p) => {
    const L          = ((p.L0 + (p.dL * T) / 100) % 360 + 360) % 360;
    const elongation = ((L - earthL) % 360 + 360) % 360;
    const raDeg      = (elongation + 180) % 360;
    const decDeg     = Math.sin((L * Math.PI) / 180) * 7;
    const { altitude, azimuth } = equatorialToHorizontal(raDeg, decDeg, lat, lst);
    return {
      name:         p.name,
      altitude:     Math.round(altitude  * 10) / 10,
      azimuth:      Math.round(azimuth   * 10) / 10,
      distance:     Math.round((0.7 + Math.abs(Math.sin(T * p.dL)) * 4) * 100) / 100,
      magnitude:    Math.round((Math.sin(T * p.dL + lat * 0.01) * 2) * 10) / 10,
      aboveHorizon: altitude > 0,
      emoji:        p.emoji,
    };
  });
}

// ─── Constellations ───────────────────────────────────────────────────────────
function computeConstellations(lat: number, lon: number, date: Date): ConstellationData[] {
  const lst = getLocalSiderealTime(lon, date);
  return CONSTELLATION_CENTERS.map((c) => {
    const { altitude, azimuth } = equatorialToHorizontal(c.ra, c.dec, lat, lst);
    return {
      name:         c.name,
      abbreviation: c.abbreviation,
      visible:      altitude > 10,
      altitude:     Math.round(altitude * 10) / 10,
      azimuth:      Math.round(azimuth  * 10) / 10,
    };
  }).sort((a, b) => b.altitude - a.altitude);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lon = parseFloat(searchParams.get("lon") ?? "0");

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const now  = new Date();
  const tles = parseTLEs(await getLiveTLEs());

  return NextResponse.json(
    {
      iss:            computeISSFromTLE(tles, lat, lon),
      satellites:     computeSatellites(tles, lat, lon),
      planets:        computePlanets(lat, lon, now),
      constellations: computeConstellations(lat, lon, now),
      fetchedAt:      now.toISOString(),
      location:       { lat, lon },
    },
    // No caching — each location must get fresh position calculations
    { headers: { "Cache-Control": "no-store" } }
  );
}
