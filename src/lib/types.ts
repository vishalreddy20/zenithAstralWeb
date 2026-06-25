export interface SelectedLocation {
  lat: number;
  lon: number;
  name?: string;
  timestamp: number;
}

export interface ISSData {
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  visibility: string;
  aboveHorizon: boolean;
  azimuth: number;
  elevation: number;
  nextPass: { risetime: number; duration: number; maxElevation: number } | null;
}

export interface SatelliteData {
  name: string;
  noradId: number;
  lat: number;
  lon: number;
  altitude: number;
  elevation: number;
  azimuth: number;
  velocity: number;
  category: string;
}

export interface PlanetData {
  name: string;
  altitude: number;
  azimuth: number;
  distance: number;
  magnitude: number;
  aboveHorizon: boolean;
  emoji: string;
}

export interface ConstellationData {
  name: string;
  abbreviation: string;
  visible: boolean;
  altitude: number;
  azimuth: number;
}

export interface CelestialData {
  iss: ISSData;
  satellites: SatelliteData[];
  planets: PlanetData[];
  constellations: ConstellationData[];
  fetchedAt: string;
  location: { lat: number; lon: number };
}
