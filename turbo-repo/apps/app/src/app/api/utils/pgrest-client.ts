/**
 * TEMPORARY: pgrest client for prod Streamhub data.
 *
 * Replaces the quarkus fleet backend with direct pgrest calls against
 * `v_modulariot_trucks_tmp` (truck catalog) and
 * `rpc/api_modular_map_positions` (last-known positions).
 *
 * Auth: reuses the existing shared `AuthToken` M2M rotation — configured
 * from STREAMHUB_CLIENT_ID / STREAMHUB_CLIENT_SECRET / STREAMHUB_AUDIENCE.
 * Base URL comes from STREAMHUB_URL.
 *
 * Gated by MIOT_FLEET_SOURCE=pgrest. Remove this file and the branch in
 * `api/fleet/trucks/route.ts` once the quarkus backend exposes the
 * equivalent data.
 */

import "server-only";
import { getSharedAuthToken } from "./streamhub-api-client";

const DEFAULT_PGREST_URL = "https://pgrest.streamhub.cl/api/v1/pgrest";

// --- Row shapes returned by the two pgrest endpoints. ---
// Only columns the fleet card actually reads are listed; pgrest returns more.

export interface PgrestTruckCatalogRow {
  mbl_id: number;
  patente: string;
  status: string | null;
  chassis_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  description: string | null;
  brand_id: string | null;
  model_year: number | null;
  type_id: string | null;
  group_id: string | null;
  maintenance_frequency: number | null;
  device_usage_qty: number | null;
  ubicacion: string | null;
}

export interface PgrestMapPositionRow {
  asset_id: string;
  timestamp: string | null;
  location: string | null; // EWKB hex
  speed: number | null;
  heading: number | null;
  gps_provider: string | null;
}

/** Lat/lon decoded from a PostGIS EWKB hex POINT string. */
export interface DecodedPoint {
  latitude: number;
  longitude: number;
}

/**
 * Decode a PostGIS EWKB hex string of a POINT into lat/lon.
 *
 * Format (little-endian variant produced by PostGIS ST_AsEWKB):
 *   byte 0      : byte order (0x01 = LE)
 *   bytes 1..4  : wkbType | SRID flag
 *   bytes 5..8  : SRID (4326 for lon/lat)
 *   bytes 9..16 : X (longitude) as IEEE-754 double
 *   bytes 17..24: Y (latitude)  as IEEE-754 double
 *
 * Returns null on malformed input instead of throwing.
 */
export function decodeEwkbPoint(hex: string | null | undefined): DecodedPoint | null {
  if (!hex || hex.length < 50) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(hex, "hex");
  } catch {
    return null;
  }
  if (buf.length < 25) return null;
  const littleEndian = buf.readUInt8(0) === 1;
  const longitude = littleEndian ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
  const latitude = littleEndian ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * The tenant client_id used by `api_modular_map_positions` is the same as
 * the M2M client_id we authenticate with. Read from env instead of decoding
 * the minted JWT — one less round-trip per call and one less failure mode.
 */
export function getPgrestClientId(): string {
  const id = process.env.STREAMHUB_CLIENT_ID;
  if (!id) {
    throw new Error("STREAMHUB_CLIENT_ID env var is not set");
  }
  return id;
}

/** pgrest base URL with trailing slash tolerated. */
function pgrestBaseUrl(): string {
  const raw = process.env.STREAMHUB_URL ?? DEFAULT_PGREST_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Fetch a fresh M2M token via the shared AuthToken singleton. The underlying
 * class caches until the JWT's `exp` and deduplicates concurrent requests.
 */
async function bearerToken(): Promise<string> {
  return getSharedAuthToken().getToken();
}

/**
 * Fetch every row of `v_modulariot_trucks_tmp` visible to the token's tenant.
 * pgrest applies row-level security via the JWT, so no explicit tenant filter
 * is needed on this call.
 */
export async function fetchTrucksCatalog(): Promise<PgrestTruckCatalogRow[]> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/v_modulariot_trucks_tmp`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "Range-Unit": "items",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET v_modulariot_trucks_tmp failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as PgrestTruckCatalogRow[];
}

/**
 * Fetch the last-known position per asset for the given tenant via the
 * `api_modular_map_positions` stored function. `p_is_dev=true` makes the
 * function LEFT JOIN the trip table, so it returns assets even without an
 * active trip — which is what the fleet card wants.
 */
export async function fetchLastPositions(
  clientId: string
): Promise<PgrestMapPositionRow[]> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/rpc/api_modular_map_positions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_client_id: clientId, p_is_dev: true }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest POST rpc/api_modular_map_positions failed: ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as
    | PgrestMapPositionRow[]
    | { data: PgrestMapPositionRow[]; status?: number; message?: string };
  if (Array.isArray(body)) return body;
  return body?.data ?? [];
}
