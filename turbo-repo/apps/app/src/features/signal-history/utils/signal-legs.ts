import { haversineKm } from "@/features/calendar/utils/distance";
import { tripIdOf } from "@/features/symptoms/model/treatment-link";

type Point = { longitude: number; latitude: number; speed?: number | null };

/** The trip id of a signal, or null when it has none. */
export function tripIdOfSignal(
  tripid: string | number | null | undefined
): string | null {
  return tripIdOf(tripid) || null;
}

/**
 * Each position with `distance`: the metres from the previous one, as the AVL
 * API sent it; 0 for the first and between two stopped positions, so a parked
 * vehicle's GPS jitter does not count. Positions must be oldest first.
 */
export function withDistances<T extends Point>(
  positions: T[]
): (T & { distance: number })[] {
  let previous: Point | null = null;
  return positions.map((position) => {
    const valid =
      Number.isFinite(position.longitude) && Number.isFinite(position.latitude);
    const moving = (position.speed ?? 0) > 0 || (previous?.speed ?? 0) > 0;
    const distance =
      previous && valid && moving
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
