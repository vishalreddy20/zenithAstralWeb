// Astronomy computation utilities
// Uses spherical trigonometry to compute altitude/azimuth from observer coords

export function toRad(deg: number) { return deg * Math.PI / 180; }
export function toDeg(rad: number) { return rad * 180 / Math.PI; }

/**
 * Convert equatorial coordinates (RA, Dec) to horizontal (Alt, Az)
 * for a given observer latitude and Local Sidereal Time
 */
export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lstDeg: number
): { altitude: number; azimuth: number } {
  const ra = toRad(raDeg);
  const dec = toRad(decDeg);
  const lat = toRad(latDeg);
  const lst = toRad(lstDeg);

  const ha = lst - ra; // Hour angle

  const sinAlt =
    Math.sin(dec) * Math.sin(lat) +
    Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const altitude = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));

  const cosAz =
    (Math.sin(dec) - Math.sin(toRad(altitude)) * Math.sin(lat)) /
    (Math.cos(toRad(altitude)) * Math.cos(lat));
  let azimuth = toDeg(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  if (Math.sin(ha) > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

/**
 * Get Local Sidereal Time in degrees for a given longitude and UTC date
 */
export function getLocalSiderealTime(lonDeg: number, date: Date): number {
  const J2000 = 2451545.0;
  const JD =
    date.getTime() / 86400000 + 2440587.5;
  const D = JD - J2000;
  const GMST = 280.46061837 + 360.98564736629 * D;
  const LST = ((GMST + lonDeg) % 360 + 360) % 360;
  return LST;
}

/**
 * Compute altitude/azimuth of a satellite given observer and satellite lat/lon/alt
 */
export function getSatelliteAltAz(
  obsLat: number,
  obsLon: number,
  satLat: number,
  satLon: number,
  satAltKm: number
): { elevation: number; azimuth: number } {
  const R = 6371; // Earth radius km
  const obsLat_r = toRad(obsLat);
  const obsLon_r = toRad(obsLon);
  const satLat_r = toRad(satLat);
  const satLon_r = toRad(satLon);

  // Observer position vector
  const ox = R * Math.cos(obsLat_r) * Math.cos(obsLon_r);
  const oy = R * Math.cos(obsLat_r) * Math.sin(obsLon_r);
  const oz = R * Math.sin(obsLat_r);

  // Satellite position vector
  const sr = R + satAltKm;
  const sx = sr * Math.cos(satLat_r) * Math.cos(satLon_r);
  const sy = sr * Math.cos(satLat_r) * Math.sin(satLon_r);
  const sz = sr * Math.sin(satLat_r);

  // Range vector
  const rx = sx - ox, ry = sy - oy, rz = sz - oz;
  const rangeKm = Math.sqrt(rx * rx + ry * ry + rz * rz);

  // Local ENU unit vectors
  const eN = [-Math.sin(obsLat_r) * Math.cos(obsLon_r), -Math.sin(obsLat_r) * Math.sin(obsLon_r), Math.cos(obsLat_r)];
  const eE = [-Math.sin(obsLon_r), Math.cos(obsLon_r), 0];
  const eU = [Math.cos(obsLat_r) * Math.cos(obsLon_r), Math.cos(obsLat_r) * Math.sin(obsLon_r), Math.sin(obsLat_r)];

  const N = (rx * eN[0] + ry * eN[1] + rz * eN[2]) / rangeKm;
  const E = (rx * eE[0] + ry * eE[1] + rz * eE[2]) / rangeKm;
  const U = (rx * eU[0] + ry * eU[1] + rz * eU[2]) / rangeKm;

  const elevation = toDeg(Math.asin(Math.max(-1, Math.min(1, U))));
  let azimuth = toDeg(Math.atan2(E, N));
  if (azimuth < 0) azimuth += 360;

  return { elevation, azimuth };
}
