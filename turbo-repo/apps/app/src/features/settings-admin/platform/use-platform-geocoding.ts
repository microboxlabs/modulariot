"use client";

import useSWR from "swr";
import { ApiError, getJson, sendEmpty, sendJson } from "../data/json-client";

const URL = "/app/api/admin/platform/geocoding-provider";

export type GeocodingProviderName = "mapbox" | "google";

/** Mirrors `PlatformGeocodingService.PlatformGeocodingView`. */
export interface PlatformGeocoding {
  configured: boolean;
  connectionId: string | null;
  provider: GeocodingProviderName | null;
  /** Mapbox only. */
  permanent: boolean | null;
  /** What one call costs the platform. */
  costPerRequestUsd: number | null;
  tokenPreview: string | null;
}

/** Mirrors `SetPlatformGeocodingRequest`. `token` blank keeps the stored one. */
export interface SetPlatformGeocoding {
  provider: GeocodingProviderName;
  token: string;
  permanent: boolean;
  costPerRequestUsd: number | null;
}

/** The platform's geocoding provider, with save and remove. */
export function usePlatformGeocoding() {
  const { data, error, isLoading, mutate } = useSWR<
    PlatformGeocoding,
    ApiError
  >("platform-geocoding", () => getJson<PlatformGeocoding>(URL), {
    revalidateOnFocus: false,
  });

  const save = async (value: SetPlatformGeocoding) => {
    const saved = await sendJson<PlatformGeocoding>("PUT", URL, value);
    await mutate(saved, { revalidate: false });
  };

  const remove = async () => {
    await sendEmpty("DELETE", URL);
    await mutate();
  };

  return {
    provider: data ?? null,
    isLoading,
    error: error ?? null,
    save,
    remove,
  };
}
