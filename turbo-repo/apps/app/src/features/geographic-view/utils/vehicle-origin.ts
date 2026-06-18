/**
 * Geometry helpers for the trip map's "vehicle distance/ETA to origin" readout
 * (issue: draw origin/end flags + show how far the vehicle is from the origin
 * + ETA). The origin/end flags already render via `GeofencePinLayer`; these
 * helpers add the distance from the current vehicle position to the origin
 * geofence centroid, plus a rough ETA from the vehicle's reported speed.
 */

/** `[longitude, latitude]` tuple, matching deck.gl / GeoJSON ordering. */
export type LngLat = [number, number];

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in kilometres between two points. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Average position of a polygon ring of `[lng, lat]` points — mirrors
 * `GeofencePinLayer.calculateAveragePosition`, so the distance is measured to
 * the same spot the origin flag is drawn. Returns null for an empty ring.
 */
export function ringCentroid(ring: LngLat[]): LngLat | null {
  if (ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return [lng / ring.length, lat / ring.length];
}

/**
 * Estimated hours for a vehicle to cover `distanceKm` at `speedKmh`. Returns
 * null when the vehicle is stopped or its speed is unknown — there is no
 * meaningful ETA in that case, so the UI shows a placeholder instead.
 */
export function estimateEtaHours(
  distanceKm: number,
  speedKmh: number | null | undefined
): number | null {
  if (!speedKmh || speedKmh <= 0) return null;
  return distanceKm / speedKmh;
}

/** Format a duration in hours as `"Xh Ym"` (or `"Ym"` when under an hour). */
export function formatEtaHours(hours: number): string {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
