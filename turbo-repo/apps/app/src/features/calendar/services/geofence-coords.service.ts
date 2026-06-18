"use client";

import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type { FetcherError } from "@/features/common/providers/fetcher.types";
import type { GeofenceCoordsResponse } from "./geofence-coords.service.types";

/**
 * Resolve a service's origin/destination geofence names to centroids via
 * `/app/api/calendar/geofence-coords` (→ streamhub `geofences` table). Stays
 * idle until at least one name is provided. Cached aggressively — geofence
 * geometry is effectively static.
 */
export function useGeofenceCoords(
  origin?: string | null,
  destination?: string | null
) {
  const normalizedOrigin = origin?.trim() || null;
  const normalizedDestination = destination?.trim() || null;
  const params = new URLSearchParams();
  if (normalizedOrigin) params.set("origin", normalizedOrigin);
  if (normalizedDestination) params.set("destination", normalizedDestination);
  const key =
    normalizedOrigin || normalizedDestination
      ? `/app/api/calendar/geofence-coords?${params.toString()}`
      : null;

  const { data } = useSWR<GeofenceCoordsResponse, FetcherError>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
    errorRetryCount: 1,
  });

  return {
    originCoord: data?.origin ?? null,
    destinationCoord: data?.destination ?? null,
  };
}
