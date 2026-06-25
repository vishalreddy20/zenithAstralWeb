/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        space: {
          black: '#04050f',
          deep: '#070b1a',
          navy: '#0a0f2c',
          blue: '#0d1540',
        },
        cosmic: {
          cyan: '#00e5ff',
          teal: '#00bcd4',
          purple: '#7c3aed',
          gold: '#ffd700',
          silver: '#c0c8d8',
        },
      },
      fontFamily: {
        space: ['Orbitron', 'monospace'],
        body: ['Exo 2', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #00e5ff, 0 0 10px #00e5ff' },
          '100%': { boxShadow: '0 0 20px #00e5ff, 0 0 40px #00e5ff, 0 0 60px #00bcd4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      backgroundImage: {
        'star-field': "radial-gradient(ellipse at center, #0d1540 0%, #04050f 100%)",
        'cosmic-glow': "radial-gradient(circle at 50% 50%, rgba(0,229,255,0.08) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};
