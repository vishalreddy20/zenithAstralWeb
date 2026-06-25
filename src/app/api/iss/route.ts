import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    // Live ISS position
    const posRes = await fetch('http://api.open-notify.org/iss-now.json', {
      next: { revalidate: 5 },
    });
    const posData = await posRes.json();

    let passData = null;

    // ISS pass predictions for selected location (if lat/lon provided)
    if (lat && lon) {
      try {
        const passRes = await fetch(
          `http://api.open-notify.org/iss-pass.json?lat=${lat}&lon=${lon}&n=3`,
          { next: { revalidate: 60 } }
        );
        if (passRes.ok) {
          passData = await passRes.json();
        }
      } catch {
        // pass predictions are optional
      }
    }

    const issLat = parseFloat(posData.iss_position.latitude);
    const issLon = parseFloat(posData.iss_position.longitude);

    // Calculate altitude above observer using simple horizon check
    // ISS orbital altitude ~408 km, speed ~7.66 km/s
    const isAboveHorizon = lat && lon
      ? checkAboveHorizon(issLat, issLon, parseFloat(lat), parseFloat(lon))
      : false;

    return NextResponse.json({
      position: {
        latitude: issLat,
        longitude: issLon,
        altitude: 408, // km — ISS standard orbital altitude
        speed: 27600,  // km/h — ISS orbital speed
      },
      isAboveHorizon,
      passes: passData?.response || [],
      timestamp: posData.timestamp,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch ISS data' }, { status: 500 });
  }
}

// Simple horizon check: ISS is visible if within ~2200 km ground track radius
function checkAboveHorizon(issLat: number, issLon: number, obsLat: number, obsLon: number): boolean {
  const R = 6371; // Earth radius km
  const dLat = ((issLat - obsLat) * Math.PI) / 180;
  const dLon = ((issLon - obsLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((obsLat * Math.PI) / 180) *
    Math.cos((issLat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // ISS at 408km altitude: visible horizon ~2300km
  return dist < 2300;
}
