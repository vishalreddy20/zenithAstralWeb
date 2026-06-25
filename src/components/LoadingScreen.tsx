"use client";
import { useEffect, useState } from "react";

const MESSAGES = [
  "INITIALIZING CESIUM ENGINE...",
  "LOADING EARTH TERRAIN...",
  "CALIBRATING CELESTIAL SENSORS...",
  "CONNECTING TO TELEMETRY FEEDS...",
  "ALIGNING COSMIC RADAR...",
];

export default function LoadingScreen() {
  const [msg, setMsg] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgId = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1200);
    const progId = setInterval(() => setProgress((p) => Math.min(95, p + Math.random() * 12)), 400);
    return () => { clearInterval(msgId); clearInterval(progId); };
  }, []);

  return (
    <div className="fixed inset-0 bg-space-950 flex flex-col items-center justify-center z-50">
      {/* Animated rings */}
      <div className="relative w-32 h-32 mb-10">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-spin" style={{ animationDuration: "3s" }} />
        <div className="absolute inset-4 rounded-full border border-cyan-400/50" style={{ animation: "spin 6s linear infinite reverse" }} />
        <div className="absolute inset-0 flex items-center justify-center text-5xl">🌌</div>
      </div>

      <div className="font-mono text-2xl font-bold text-white mb-1 glow-cyan">PROJECT ZENITH</div>
      <div className="font-mono text-sm text-cyan-400 tracking-widest mb-10">THE CELESTIAL EYE</div>

      {/* Progress bar */}
      <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-cyan-700 to-cyan-400 rounded-full transition-all duration-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="font-mono text-xs text-gray-500 tracking-widest">{MESSAGES[msg]}</div>
    </div>
  );
}
