import type { GeoPoint } from "@/types";

const EARTH_RADIUS_KM = 6371;

/** Great-circle (straight-line) distance between two points, in km. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Midpoint between two coordinates — used to place section labels/heatmap markers along a route. */
export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/** Compass bearing from `a` to `b`, in degrees clockwise from north (0-360) — for pointing a directional marker along a leg. */
export function computeBearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface MapView {
  center: GeoPoint;
  zoom: number;
}

/**
 * A center + zoom that frames a whole set of points — a route's stations, for
 * instance — so the map can be given a stable view of "this journey" once,
 * rather than re-centering on the train's live position every tick. `<MapContainer>`
 * takes center/zoom rather than a bounds box (Leaflet's own `fitBounds` isn't
 * exposed through it), so this is a deliberately approximate stand-in: it
 * assumes a roughly-Mercator degrees-per-pixel relationship rather than doing
 * Leaflet's own tile-grid math, which is exact but only computable once a map
 * instance exists. Good enough to put "the whole corridor" in frame; not a
 * substitute for `fitBounds` if pixel-perfect framing is ever needed.
 */
export function computeBoundsView(
  points: GeoPoint[],
  options: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): MapView {
  const { padding = 1.4, minZoom = 4, maxZoom = 10 } = options;

  if (points.length === 0) {
    return { center: { lat: 22.5, lng: 80.0 }, zoom: minZoom + 1 }; // India, roughly centered
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  const center: GeoPoint = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

  // A single point (or a cluster with no real spread) still needs a sane
  // close-in zoom rather than a division by ~zero.
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.05);
  const zoom = Math.round(Math.min(maxZoom, Math.max(minZoom, Math.log2(360 / (span * padding)))));

  return { center, zoom };
}
