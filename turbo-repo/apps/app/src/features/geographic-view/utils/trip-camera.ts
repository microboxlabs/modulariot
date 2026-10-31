import { toLngLat } from "@/features/map-visualization/map-view-utils";

type Point = { longitude: number; latitude: number };

/** Street level: one position or a case point has no extent to fit. */
export const SINGLE_POINT_ZOOM = 13;
/** A trip spans cities, so its fit stays at region level. */
export const TRIP_MAX_ZOOM = 8;
/** A case's track can be a few hundred metres; stop before a 50 m track fills the screen. */
export const CASE_MAX_ZOOM = 16;
export const BOUNDS_PADDING = 60;

export type TripCamera =
  | { kind: "point"; target: [number, number]; zoom: number }
  | {
      kind: "bounds";
      bounds: [[number, number], [number, number]];
      maxZoom: number;
      /** A tilted camera pushes the near end of a short track off the bottom edge. */
      pitch: number;
      bearing: number;
    }
  | null;

/**
 * Where the trip map looks: the bounds of two or more positions (with the case
 * point, when there is one), a single position, else the case point; null
 * when there is nothing to show.
 */
export function tripCamera(
  positions: Point[] | null | undefined,
  casePoint: Point | null | undefined
): TripCamera {
  const points = (positions ?? [])
    .map((p) => toLngLat(p.longitude, p.latitude))
    .filter((p): p is [number, number] => p !== null);
  if (points.length > 1) {
    const extra = casePoint
      ? toLngLat(casePoint.longitude, casePoint.latitude)
      : null;
    const all = extra ? [...points, extra] : points;
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    return {
      kind: "bounds",
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      maxZoom: casePoint ? CASE_MAX_ZOOM : TRIP_MAX_ZOOM,
      pitch: casePoint ? 0 : 45,
      bearing: casePoint ? 0 : 45,
    };
  }
  const only =
    points[0] ??
    (casePoint ? toLngLat(casePoint.longitude, casePoint.latitude) : null);
  return only ? { kind: "point", target: only, zoom: SINGLE_POINT_ZOOM } : null;
}

/** "No data" only once loading ends with neither a position nor a case point. */
export function showsNoData(
  isLoading: boolean,
  positions: Point[] | null | undefined,
  casePoint: Point | null | undefined
): boolean {
  return !isLoading && !positions?.length && !casePoint;
}
