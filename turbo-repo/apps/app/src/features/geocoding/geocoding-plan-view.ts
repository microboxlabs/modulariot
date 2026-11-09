import type { GeocodingUsage } from "./geocoding-plan.types";

/** Share of resolutions answered by the cache, 0–100, or null when there were none. */
export function cacheHitRate(usage: GeocodingUsage): number | null {
  if (usage.resolutions === 0) return null;
  return Math.round((usage.cacheHits / usage.resolutions) * 100);
}
