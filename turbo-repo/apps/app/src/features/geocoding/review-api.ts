"use client";

import useSWR, { mutate } from "swr";
import { tripsRequest } from "@/features/trips/monitors/monitors-api";
import {
  fetchLocations,
  type TripLocation,
} from "@/features/trips/locations/locations-api";

/** A location with where it is and how it was resolved (`LocationView`). */
export interface PlacedLocation extends TripLocation {
  address: string | null;
  country: string | null;
  districtCode: string | null;
  district: string | null;
  plusCode: string | null;
  latitude: number | null;
  longitude: number | null;
  resolutionSource: string | null;
  resolutionStatus: string | null;
  resolutionNote: string | null;
}

/** A point set by hand: a Plus Code, or coordinates. */
export type ManualPoint =
  | { plusCode: string }
  | { latitude: number; longitude: number };

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;
const REVIEW_KEY = `${API}/locations?status=needs_review&size=200`;

/** Every location the resolver sent to review, with the reason in `resolutionNote`. */
export function useReviewQueue() {
  return useSWR<PlacedLocation[]>(REVIEW_KEY, fetchLocations<PlacedLocation>, {
    keepPreviousData: true,
  });
}

async function refreshLocations() {
  await mutate(
    (key) => typeof key === "string" && key.startsWith(`${API}/locations?`)
  );
}

/**
 * Checks the point against the location's district and creates its geofence.
 * A point outside the district is refused with the reason (HTTP 400).
 */
export async function placeLocation(id: string, point: ManualPoint) {
  const saved = await tripsRequest<PlacedLocation>(
    `${API}/locations/${encodeURIComponent(id)}/point`,
    { method: "PUT", body: point }
  );
  await refreshLocations();
  return saved;
}

/** Marks a location as one that cannot be located. */
export async function rejectLocation(id: string, note: string) {
  const saved = await tripsRequest<PlacedLocation>(
    `${API}/locations/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: { note: note.trim() || null } }
  );
  await refreshLocations();
  return saved;
}

const COUNTRY_CENTERS: Record<string, { latitude: number; longitude: number }> =
  {
    PE: { latitude: -12.0464, longitude: -77.0428 },
    CL: { latitude: -33.4489, longitude: -70.6693 },
  };

/** Where the map opens: the point the resolver found, else the country's capital, else Lima. */
export function initialPoint(location: PlacedLocation) {
  if (location.latitude !== null && location.longitude !== null) {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return COUNTRY_CENTERS[location.country ?? ""] ?? COUNTRY_CENTERS.PE!;
}

/** `-12.046400, -77.042800`: six decimals are about 10 cm. */
export function formatPoint(point: { latitude: number; longitude: number }) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}
