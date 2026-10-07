/** Match the previous 2D pin angle so the truck keeps the same heading. */
export function headingToYaw(heading: number): number {
  return Math.round(360 + heading);
}

export function truckOrientation(heading: number): [number, number, number] {
  // glTF models are Y-up; the extra roll stands the truck on the map.
  return [0, headingToYaw(heading), 90];
}

/** Offset in meters: GPS heading 0 = north, 90 = east. */
export function headingOffsetMeters(
  heading: number,
  forward: number,
  up: number
): [number, number, number] {
  const rad = (heading * Math.PI) / 180;
  return [Math.sin(rad) * forward, Math.cos(rad) * forward, up];
}

export const TRUCK_MODEL_MIN_ZOOM = 10;

export function shouldShowTruckModel(zoom: number): boolean {
  return zoom >= TRUCK_MODEL_MIN_ZOOM;
}
