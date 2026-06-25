// Type declaration for satellite.js v5
// The package ships JavaScript-only; this shim lets TypeScript compile cleanly.
// If @types/satellite.js is ever published, remove this file.
declare module "satellite.js" {
  export interface EciVec3<T> {
    x: T;
    y: T;
    z: T;
  }

  export interface GeodeticLocation {
    longitude: number; // radians
    latitude: number;  // radians
    height: number;    // km
  }

  export interface SatRec {
    error: number;
    [key: string]: any;
  }

  export interface StateVector {
    position: EciVec3<number> | boolean;
    velocity: EciVec3<number> | boolean;
  }

  export function twoline2satrec(tleLine1: string, tleLine2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): StateVector;
  export function gstime(date: Date): number;
  export function eciToGeodetic(eci: EciVec3<number>, gmst: number): GeodeticLocation;
  export function degreesLat(radians: number): number;
  export function degreesLong(radians: number): number;
}
