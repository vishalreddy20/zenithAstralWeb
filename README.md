# Project Zenith: The Celestial Eye

**Team:** ZenithForge
**Hackathon:** AstralWeb Innovate (Round 2)
**Live URL:** [https://zenith-astral-web.vercel.app/](https://zenith-astral-web.vercel.app/)

## 🌌 Project Overview
Project Zenith: The Celestial Eye is a dynamic, interactive web application that functions as a real-time cosmic radar. It bridges the gap between humanity and the cosmos by allowing users to select any geographic coordinate on Earth and instantly visualize the celestial bodies passing through that location's zenith. 

Unlike static planetarium simulators, Project Zenith pulls live telemetry data to mathematically propagate satellite orbits and planetary positions in real-time.

## ✨ Key Features & Unique Selling Points
- **Interactive 3D Globe:** Built with MapLibre GL JS, featuring a token-free, fully spherical dark-matter map projection that fits the cosmic aesthetic perfectly.
- **Real-Time SGP4 Orbital Propagation:** Uses `satellite.js` to calculate live positions, altitudes, and velocities for the International Space Station (ISS) and various earth-observation satellites using live Two-Line Elements (TLEs) fetched directly from CelesTrak.
- **Location-Aware Horizon Filtering:** Employs complex astronomical mathematics to convert Equatorial Coordinates (Right Ascension/Declination) to Horizontal Coordinates (Altitude/Azimuth), ensuring you only see what is *actually* above your horizon at your specific latitude and longitude.
- **SkyView Radar:** A custom-built SVG polar coordinate radar chart that maps the exact position of overhead objects in a 360-degree top-down view.
- **Next Pass Prediction:** Fast-forwards the ISS orbital math to predict the exact moment it will next rise above your local horizon, complete with a live countdown timer and max elevation predictions.
- **Sci-Fi UI/UX:** A stunning, immersive dark cosmic theme with glassmorphism panels, glowing accents, and responsive CSS Grid/Flexbox layouts that work seamlessly across desktop and mobile.

## 🛠️ Technology Stack & Dependencies

### Core Frameworks
- **Next.js 14 (App Router):** Handles server-side API proxying, routing, and React component architecture.
- **React 18:** For building the reactive user interface.
- **Tailwind CSS:** For highly responsive, utility-first styling.

### Geospatial & Visualization
- **MapLibre GL JS** & **@mapcn/map**: Powers the interactive 3D globe and dynamic arc routing.
- **Lucide React:** Iconography.

### Mathematics & Telemetry
- **satellite.js:** Core SGP4/SDP4 orbital propagation library used to process TLEs.
- **CelesTrak (External Data):** Source of live satellite TLEs.
- **WhereTheISS.at (External Data):** High-frequency ISS telemetry data.
- **Nominatim (External Data):** OpenStreetMap's geocoding API for coordinate search.

*Note: The project was architected to rely entirely on open-source, token-free APIs. No paid API keys are required to run this application.*

## 🚀 Installation and Setup Instructions

To run Project Zenith locally on your machine, follow these steps:

### Prerequisites
- Node.js (v18.17.0 or higher)
- npm (Node Package Manager)

### Step 1: Clone the Repository
```bash
git clone https://github.com/vishalreddy20/zenithAstralWeb.git
cd zenith
```

### Step 2: Install Dependencies
```bash
npm install
```
*(This will install Next.js, React, MapLibre, Tailwind CSS, satellite.js, and all other required packages listed in `package.json`)*

### Step 3: Start the Development Server
```bash
npm run dev
```

### Step 4: Access the Application
Open your web browser and navigate to:
`http://localhost:3000`

## 🏗️ Architecture Overview
The application follows a "Data-First" architecture:
1. **Server-Side API (`/api/celestial`)**: Acts as a secure proxy. It fetches live TLEs from CelesTrak, caches them in-memory to prevent rate-limiting, runs the heavy SGP4 propagation math to find objects above the user's horizon, and returns a clean JSON payload.
2. **Client-Side Rendering**: The UI consumes the API data and uses React state to drive the MapLibre 3D globe, update the SkyView radar, and manage the live countdowns without freezing the browser thread.

## 🔮 Future Enhancements
- **Constellation Line Rendering:** Drawing actual constellation boundary lines over the 3D globe based on RA/Dec calculations.
- **Time Travel Mode:** A timeline slider allowing users to fast-forward the celestial map 24-48 hours into the future.
- **AR View:** Integration with WebXR to allow mobile users to point their phones at the sky and overlay the data directly onto their camera feed.
