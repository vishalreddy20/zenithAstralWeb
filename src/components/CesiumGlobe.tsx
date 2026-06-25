"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { SelectedLocation, CelestialData } from "@/lib/types";

interface Props {
  onLocationSelect: (loc: SelectedLocation) => void;
  selectedLocation: SelectedLocation | null;
  celestialData: CelestialData | null;
  onReady: () => void;
  onISSUpdate: (lat: number, lon: number) => void;
}

export default function CesiumGlobe({
  onLocationSelect,
  selectedLocation,
  celestialData,
  onReady,
  onISSUpdate,
}: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const viewerRef       = useRef<any>(null);
  const issEntityRef    = useRef<any>(null);
  const groundTrackRef  = useRef<any>(null);
  const markerRef       = useRef<any>(null);
  const satEntitiesRef  = useRef<any[]>([]);
  const issIntervalRef  = useRef<NodeJS.Timeout | null>(null);
  const [globeError, setGlobeError] = useState<string | null>(null);
  const [globeLoading, setGlobeLoading] = useState(true);

  // ── Globe initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const init = async () => {
      try {
        // Workers and static assets are at /cesium/ (copied by CopyWebpackPlugin)
        (window as any).CESIUM_BASE_URL = "/cesium/";

        const mod = await import("cesium");
        const Cesium = (mod as any).default ?? mod;

        Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN!;

        // ── Imagery: ESRI World Imagery (free, no key) → NaturalEarthII → OSM ──
        // ESRI World Imagery provides beautiful satellite photos of Earth with
        // clear land/ocean boundaries. No API key or CesiumIon token required.
        let baseImagery: any;
        try {
          baseImagery = new Cesium.UrlTemplateImageryProvider({
            url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            credit: "Esri, Maxar, Earthstar Geographics",
            minimumLevel: 0,
            maximumLevel: 18,
          });
        } catch {
          try {
            baseImagery = await Cesium.TileMapServiceImageryProvider.fromUrl(
              "/cesium/Assets/Textures/NaturalEarthII"
            );
          } catch {
            baseImagery = new Cesium.UrlTemplateImageryProvider({
              url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              credit: "Map data © OpenStreetMap contributors",
            });
          }
        }

        // ── Terrain: try CesiumIon world terrain → ellipsoid fallback ────────
        let terrainProvider: any;
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync();
        } catch {
          terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }

        const viewer = new Cesium.Viewer(containerRef.current!, {
          imageryProvider: baseImagery,
          terrainProvider,
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          contextOptions: { webgl: { alpha: false } },
          requestRenderMode: false,
        });

        // Mobile container fix
        if (viewer.container) {
          (viewer.container as HTMLElement).style.width  = "100%";
          (viewer.container as HTMLElement).style.height = "100%";
        }

        // Atmosphere & lighting
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#02040a");

        // Initial camera position
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(78.96, 20.59, 18_000_000),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
        });

        viewerRef.current = viewer;
        setGlobeLoading(false);
        onReady();

        // Click handler
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: any) => {
          const carto = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
          if (!carto) return;
          const c = Cesium.Cartographic.fromCartesian(carto);
          onLocationSelect({
            lat: Cesium.Math.toDegrees(c.latitude),
            lon: Cesium.Math.toDegrees(c.longitude),
            timestamp: Date.now(),
          });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Start ISS live tracking (client-side fetch — no server network restrictions)
        startISSTracking(Cesium, viewer);

      } catch (err: any) {
        console.error("Globe init error:", err);
        setGlobeError(err?.message ?? "Unknown Cesium error");
        setGlobeLoading(false);
      }
    };

    init();

    return () => {
      if (issIntervalRef.current) clearInterval(issIntervalRef.current);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ISS live tracking (fetched CLIENT-SIDE → no server restrictions) ──────
  const startISSTracking = useCallback(async (Cesium: any, viewer: any) => {
    const updateISS = async () => {
      try {
        // wheretheiss.at — reliable, no CORS issues from browser
        const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
        if (!res.ok) throw new Error("ISS API error");
        const d = await res.json();

        const issLat = parseFloat(d.latitude);
        const issLon = parseFloat(d.longitude);
        const altM   = (d.altitude ?? 408) * 1000;
        // API returns km/s → convert to km/h for display
        const velKmh = Math.round((d.velocity ?? 7.66) * 3600);

        if (!viewer || viewer.isDestroyed()) return;
        onISSUpdate(issLat, issLon);

        // Rebuild ISS entity
        if (issEntityRef.current) viewer.entities.remove(issEntityRef.current);
        issEntityRef.current = viewer.entities.add({
          name: "ISS",
          position: Cesium.Cartesian3.fromDegrees(issLon, issLat, altM),
          billboard: {
            image: createISSIcon(),
            width: 44, height: 44,
            verticalOrigin:   Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scaleByDistance:  new Cesium.NearFarScalar(1e6, 1.5, 2e7, 0.5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: "🛸 ISS",
            font: "bold 13px 'Space Mono', monospace",
            fillColor:   Cesium.Color.fromCssColorString("#00e5ff"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -54),
            scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 2e7, 0.5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        // Draw orbit + ground track
        drawOrbitPath(Cesium, viewer, issLat, issLon, altM);
        drawGroundTrack(Cesium, viewer, issLat, issLon);

      } catch (err) {
        // Silent fail — use TLE-propagated position from API instead
        console.warn("Client ISS fetch failed:", err instanceof Error ? err.message : err);
      }
    };

    await updateISS();
    issIntervalRef.current = setInterval(updateISS, 10_000);
  }, [onISSUpdate]);

  // ── Orbital path ─────────────────────────────────────────────────────────
  const drawnOrbitRef = useRef(false);
  const drawOrbitPath = useCallback((Cesium: any, viewer: any, lat: number, lon: number, altM: number) => {
    if (drawnOrbitRef.current) return; // Draw once
    drawnOrbitRef.current = true;
    const pts: any[] = [];
    const incl = 51.6;
    for (let i = 0; i <= 360; i += 2) {
      const rad  = (i * Math.PI) / 180;
      const oLon = (lon + i * (360 / 92) + 360) % 360;
      const oLat = incl * Math.sin(rad);
      pts.push(Cesium.Cartesian3.fromDegrees(oLon > 180 ? oLon - 360 : oLon, oLat, altM));
    }
    viewer.entities.add({
      polyline: {
        positions: pts,
        width: 1.2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString("#00e5ff33"),
          dashLength: 20,
        }),
        clampToGround: false,
      },
    });
  }, []);

  // ── Ground track ──────────────────────────────────────────────────────────
  const drawGroundTrack = useCallback((Cesium: any, viewer: any, issLat: number, issLon: number) => {
    if (groundTrackRef.current) viewer.entities.remove(groundTrackRef.current);
    const incl        = 51.6 * Math.PI / 180;
    const period      = 92;
    const earthRotRate = 360 / (24 * 60);
    const phaseApprox = Math.asin(Math.max(-1, Math.min(1, Math.sin(issLat * Math.PI / 180) / Math.sin(incl))));
    const pts: any[]  = [];

    for (let t = -20; t <= 110; t += 0.5) {
      const phase    = phaseApprox + (2 * Math.PI / period) * t;
      const trackLat = Math.asin(Math.sin(incl) * Math.sin(phase)) * 180 / Math.PI;
      const dLon     =
        (Math.atan2(Math.cos(incl) * Math.sin(phase), Math.cos(phase)) * 180 / Math.PI) -
        (Math.atan2(Math.cos(incl) * Math.sin(phaseApprox), Math.cos(phaseApprox)) * 180 / Math.PI) -
        earthRotRate * t;
      const trackLon = ((issLon + dLon) % 360 + 540) % 360 - 180;
      pts.push(Cesium.Cartesian3.fromDegrees(trackLon, trackLat, 0));
    }

    groundTrackRef.current = viewer.entities.add({
      polyline: {
        positions: pts,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString("#00e5ffaa"),
          dashLength: 8,
        }),
        clampToGround: true,
      },
    });
  }, []);

  // ── Selected location marker ──────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !selectedLocation) return;
    import("cesium").then((mod) => {
      const C = (mod as any).default ?? mod;
      if (markerRef.current) viewerRef.current.entities.remove(markerRef.current);
      markerRef.current = viewerRef.current.entities.add({
        position: C.Cartesian3.fromDegrees(selectedLocation.lon, selectedLocation.lat, 500),
        point: {
          pixelSize: 14,
          color: C.Color.fromCssColorString("#ffd700"),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `📍 ${selectedLocation.lat.toFixed(2)}°, ${selectedLocation.lon.toFixed(2)}°`,
          font: "12px 'Space Mono', monospace",
          fillColor: C.Color.fromCssColorString("#ffd700"),
          outlineColor: C.Color.BLACK,
          outlineWidth: 2,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          pixelOffset: new C.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      viewerRef.current.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(selectedLocation.lon, selectedLocation.lat, 8_000_000),
        duration: 1.8,
      });
    });
  }, [selectedLocation]);

  // ── Satellite dots ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef.current || !celestialData) return;
    import("cesium").then((mod) => {
      const C = (mod as any).default ?? mod;
      satEntitiesRef.current.forEach((e) => {
        if (viewerRef.current && !viewerRef.current.isDestroyed())
          viewerRef.current.entities.remove(e);
      });
      satEntitiesRef.current = [];

      celestialData.satellites.forEach((sat) => {
        const ent = viewerRef.current.entities.add({
          position: C.Cartesian3.fromDegrees(sat.lon, sat.lat, sat.altitude * 1000),
          point: {
            pixelSize: sat.elevation > 0 ? 8 : 5,
            color: sat.elevation > 0
              ? C.Color.fromCssColorString("#a855f7")
              : C.Color.fromCssColorString("#44337a"),
            outlineColor: C.Color.fromCssColorString("#e040fb"),
            outlineWidth: sat.elevation > 0 ? 1 : 0,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: sat.name.length > 12 ? sat.name.substring(0, 12) + "…" : sat.name,
            font: "10px monospace",
            fillColor: C.Color.fromCssColorString("#d8b4fe"),
            outlineColor: C.Color.BLACK,
            outlineWidth: 1,
            style: C.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: C.VerticalOrigin.BOTTOM,
            pixelOffset: new C.Cartesian2(0, -14),
            scaleByDistance: new C.NearFarScalar(5e5, 1, 1e7, 0.2),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        satEntitiesRef.current.push(ent);
      });
    });
  }, [celestialData]);

  // ── Error / Loading states ────────────────────────────────────────────────
  if (globeError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#02040a]">
        <div className="text-6xl">🔭</div>
        <div className="font-mono text-cyan-400 text-sm tracking-widest">GLOBE FAILED TO INITIALIZE</div>
        <div className="font-mono text-gray-500 text-xs max-w-sm text-center leading-relaxed">
          Check <code className="text-cyan-300">NEXT_PUBLIC_CESIUM_TOKEN</code> in your environment variables.
          <br /><br />
          <span className="text-red-400">{globeError}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 font-mono text-xs border border-cyan-400/40 text-cyan-400 px-6 py-2.5 rounded-lg hover:bg-cyan-400/10 transition-all"
        >
          ↺ RETRY
        </button>
      </div>
    );
  }

  return (
    <div
      id="cesium-container"
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}

// ── ISS icon ─────────────────────────────────────────────────────────────────
function createISSIcon(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <circle cx="32" cy="32" r="5" fill="#00e5ff" opacity="1"/>
    <rect x="4" y="29.5" width="56" height="5" rx="2.5" fill="#00e5ff" opacity="0.8"/>
    <rect x="27" y="4" width="10" height="56" rx="5" fill="#00e5ff" opacity="0.8"/>
    <rect x="10" y="24" width="44" height="16" rx="8" fill="none" stroke="#00e5ff" stroke-width="1.5" opacity="0.35"/>
    <circle cx="32" cy="32" r="12" fill="none" stroke="#00e5ff" stroke-width="0.8" opacity="0.25" stroke-dasharray="3 3"/>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}
