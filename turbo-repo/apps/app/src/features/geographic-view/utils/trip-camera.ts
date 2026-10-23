import { toLngLat } from "@/features/map-visualization/map-view-utils";

type Point = { longitude: number; latitude: number };

/** Street level: one position or a case point has no extent to fit. */
export const SINGLE_POINT_ZOOM = 13;

export type TripCamera =
  | { kind: "point"; target: [number, number]; zoom: number }
  | { kind: "bounds" }
  | null;

/**
 * Where the trip map looks: the bounds of two or more positions, a single
 * position, else the case point; null when there is nothing to show.
 */
export function tripCamera(
  positions: Point[] | null | undefined,
  casePoint: Point | null | undefined
): TripCamera {
  if (positions && positions.length > 1) return { kind: "bounds" };
  const only = positions?.[0] ?? casePoint;
  const target = only ? toLngLat(only.longitude, only.latitude) : null;
  return target ? { kind: "point", target, zoom: SINGLE_POINT_ZOOM } : null;
}

/** "No data" only once loading ends with neither a position nor a case point. */
export function showsNoData(
  isLoading: boolean,
  positions: Point[] | null | undefined,
  casePoint: Point | null | undefined
): boolean {
  return !isLoading && !positions?.length && !casePoint;
}
