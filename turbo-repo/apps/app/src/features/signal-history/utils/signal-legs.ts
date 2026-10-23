import { haversineKm } from "@/features/calendar/utils/distance";

type Point = { longitude: number; latitude: number };

/** The trip id of a signal, or null when it has none ("null" included, as the AVL API sent it). */
export function tripIdOfSignal(tripid: unknown): string | null {
  if (tripid === null || tripid === undefined) return null;
  const id = String(tripid).trim();
  return id === "" || id === "null" ? null : id;
}

/**
 * Each position with `distance`: the metres from the previous one, 0 for the
 * first, as the AVL API sent it. Positions must be oldest first.
 */
export function withDistances<T extends Point>(
  positions: T[]
): (T & { distance: number })[] {
  let previous: Point | null = null;
  return positions.map((position) => {
    const valid =
      Number.isFinite(position.longitude) && Number.isFinite(position.latitude);
    const distance =
      previous && valid
        ? Math.round(
            haversineKm(
              [previous.longitude, previous.latitude],
              [position.longitude, position.latitude]
            ) * 1000
          )
        : 0;
    if (valid) previous = position;
    return { ...position, distance };
  });
}
