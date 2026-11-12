const METERS_PER_DEGREE = 111_320;
const STEP_METERS = 10;

type ProjectingViewport = {
  project: (xyz: number[]) => number[];
  bearing?: number;
  pitch?: number;
  longitude?: number;
  latitude?: number;
  zoom?: number;
};

/**
 * deck.gl `getAngle` (degrees, counter-clockwise on screen) that points an
 * upward-drawn icon along a compass heading (degrees, clockwise from north).
 * Projects a point a few meters ahead of the vehicle, so the map's bearing and
 * pitch are taken into account. Without a viewport it assumes a north-up map.
 */
export function headingToIconAngle(
  viewport: ProjectingViewport | null | undefined,
  longitude: number,
  latitude: number,
  heading: number
): number {
  const northUp = -heading;
  if (!viewport || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return northUp;
  }
  const rad = (heading * Math.PI) / 180;
  const dLat = (Math.cos(rad) * STEP_METERS) / METERS_PER_DEGREE;
  const dLng =
    (Math.sin(rad) * STEP_METERS) /
    (METERS_PER_DEGREE * Math.cos((latitude * Math.PI) / 180));
  const [x0, y0] = viewport.project([longitude, latitude]);
  const [x1, y1] = viewport.project([longitude + dLng, latitude + dLat]);
  const vx = x1 - x0;
  const vy = y1 - y0;
  if (!Number.isFinite(vx) || !Number.isFinite(vy) || (vx === 0 && vy === 0)) {
    return northUp;
  }
  return (Math.atan2(-vx, -vy) * 180) / Math.PI;
}

/** Screen offset of a point `distance` pixels ahead of an icon drawn at `angle`. */
export function iconTipOffset(angle: number, distance: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [-Math.sin(rad) * distance, -Math.cos(rad) * distance];
}

/** Changes whenever the view moves, so angle attributes are recomputed. */
export function viewportKey(viewport: ProjectingViewport | null | undefined): string {
  if (!viewport) return "";
  return [
    viewport.bearing,
    viewport.pitch,
    viewport.longitude,
    viewport.latitude,
    viewport.zoom,
  ].join("|");
}
