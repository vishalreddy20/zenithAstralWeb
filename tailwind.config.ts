import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        space: {
          950: "#02040a",
          900: "#05080f",
          800: "#080d1a",
          700: "#0d1525",
        },
        cyan: { zenith: "#00e5ff" },
        gold: { zenith: "#ffd700" },
      },
      fontFamily: {
        mono: ["Space Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        pulse_slow: "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        spin_slow: "spin 20s linear infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          from: { boxShadow: "0 0 5px #00e5ff, 0 0 10px #00e5ff" },
          to: { boxShadow: "0 0 20px #00e5ff, 0 0 40px #00e5ff" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
