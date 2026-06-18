"use client";

import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import type { FetcherError } from "@/features/common/providers/fetcher.types";

export interface GeofencePoint {
  latitude: number;
  longitude: number;
}

interface GeofenceCoordsResponse {
  origin: GeofencePoint | null;
  destination: GeofencePoint | null;
}

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
  const params = new URLSearchParams();
  if (origin) params.set("origin", origin);
  if (destination) params.set("destination", destination);
  const key =
    origin || destination
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
