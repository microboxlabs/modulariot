"use client";

/**
 * Client for the trip locations API (`/trips/locations`) and the organization's
 * GPS geofences (`/trips/locations/geofences`), through the `/api/trips/*` proxy.
 */

import useSWR, { mutate } from "swr";
import { tripsRequest } from "../monitors/monitors-api";

export const LOCATION_WRITE = "trips:location.write";

export interface TripLocation {
  id: string;
  name: string;
  type: string;
  externalCode: string | null;
  geofenceId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Geofence {
  id: number;
  code: string | null;
  name: string | null;
}

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/trips`;
const searchQuery = (q: string) => (q ? `&q=${encodeURIComponent(q)}` : "");
export const locationsKey = (q: string) =>
  `${API}/locations?size=200${searchQuery(q)}`;
const geofencesKey = (q: string) =>
  `${API}/locations/geofences?size=200${searchQuery(q)}`;

const fetcher = <T>(url: string) => tripsRequest<T>(url);

async function fetchLocations(url: string) {
  const locations: TripLocation[] = [];
  for (let page = 0; ; page++) {
    const rows = await tripsRequest<TripLocation[]>(`${url}&page=${page}`);
    locations.push(...rows);
    if (rows.length < 200) return locations;
  }
}

export function useLocations(q: string) {
  return useSWR<TripLocation[]>(locationsKey(q), fetchLocations, {
    keepPreviousData: true,
  });
}

export function useGeofences(q: string) {
  return useSWR<Geofence[]>(geofencesKey(q), fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
}

export async function linkGeofence(id: string, geofenceId: number | null) {
  const saved = await tripsRequest<TripLocation>(
    `${API}/locations/${encodeURIComponent(id)}/geofence`,
    { method: "PUT", body: { geofenceId } }
  );
  await mutate(
    (key) => typeof key === "string" && key.startsWith(`${API}/locations?`)
  );
  return saved;
}

/** "Planta Sur (PS)", or the id when the directory does not list it. */
export function geofenceLabel(id: number, known: Geofence[]) {
  const g = known.find((x) => x.id === id);
  if (!g) return `#${id}`;
  const name = g.name ?? `#${id}`;
  return g.code && g.code !== name ? `${name} (${g.code})` : name;
}
