/**
 * pgrest client for StreamHub data (prod-iot-gps): geofence centroids,
 * accredited resources and the drivers view.
 *
 * Auth: reuses the shared `AuthToken` M2M rotation, configured from
 * STREAMHUB_CLIENT_ID / STREAMHUB_CLIENT_SECRET / STREAMHUB_AUDIENCE.
 * Base URL comes from STREAMHUB_URL.
 */

import "server-only";
import wkx from "wkx";
import type {
  Collaborator,
  CollaboratorDetailData,
  CollaboratorDetailDto,
} from "@/features/collaborators-management/types/collaborators.types";
import { getSharedAuthToken } from "./streamhub-api-client";

/**
 * Row shape returned by `public.v_modulariot_drivers_tmp` in prod-iot-gps.
 *
 * Temporary stub view — fabricated 1:1 from the truck catalog, so every row
 * today carries placeholder data (`name_driver = 'Conductor Automatico {patente}'`,
 * `score_driver = 0.0`, every row `is_active = true`). The `_tmp` suffix and
 * the frozen `created_at` / `updated_at` stamps confirm it will be replaced by
 * a real driver table; treat it as throwaway. See
 * `.cursor/plans/collaborators_management_integration.plan.md` for context.
 *
 * Critical: there is **no driver RUT column**. `cust_account` is the customer
 * (fleet owner) RUT, not the driver's — the collaborators search falls back
 * to `cust_account` + `name_driver` + `cod_driver` as proxies.
 */
export interface PgrestDriverRow {
  /** Numeric driver id — primary key on the temp view. */
  id: number;
  /** Driver code, today literally `{id}-{patente}` (e.g. `1-TWHS10`). */
  cod_driver: string;
  /** Display name. All rows are the `Conductor Automatico {patente}` placeholder today. */
  name_driver: string;
  /** Performance score 0..100. Currently 0.0 across all rows. */
  score_driver: number;
  /** Customer RUT (fleet owner, NOT driver). Nullable (~3% of rows). */
  cust_account: string | null;
  /** Contract id — matches `rent_id` on `v_modulariot_trucks_tmp`. Nullable. */
  rent_id: string | null;
  /** Active flag — 100% `true` in the current snapshot. */
  is_active: boolean;
  /** Currently assigned vehicle plate. 1:1 with the truck catalog. */
  patente_actual: string;
  created_at: string;
  updated_at: string;
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
export function decodeEwkbPoint(
  hex: string | null | undefined
): DecodedPoint | null {
  if (!hex) return null;
  // Strip PostgreSQL bytea hex-escape prefix (\x, 0x) if present.
  const clean = hex.replace(/^(\\x|0x)/i, "");
  if (
    clean.length < 50 ||
    clean.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(clean)
  )
    return null;
  const buf = Buffer.from(clean, "hex");
  if (buf.length < 25) return null;
  const littleEndian = buf.readUInt8(0) === 1;
  const longitude = littleEndian ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
  const latitude = littleEndian ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Centroid of an EWKB-hex (Multi)Polygon — used to place the origin/destination
 * flag for a geofence whose geometry comes from the `geofences` table. Mirrors
 * `GeofencePinLayer.calculateAveragePosition`: averages the outer ring, so the
 * flag lands on the same spot the trip map draws it. Returns null on malformed
 * input instead of throwing.
 */
export function decodeEwkbPolygonCentroid(
  hex: string | null | undefined
): DecodedPoint | null {
  const ring = decodeEwkbOuterRing(hex);
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  const longitude = lng / ring.length;
  const latitude = lat / ring.length;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Outer ring of an EWKB-hex (Multi)Polygon as `[lon, lat]` pairs (a Z value,
 * if any, is dropped). MultiPolygon → its first polygon. Returns null on
 * malformed input instead of throwing.
 */
export function decodeEwkbOuterRing(
  hex: string | null | undefined
): [number, number][] | null {
  if (!hex) return null;
  const clean = hex.replace(/^(\\x|0x)/i, "");
  if (
    clean.length === 0 ||
    clean.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(clean)
  )
    return null;
  try {
    const geo = wkx.Geometry.parse(Buffer.from(clean, "hex")).toGeoJSON() as {
      type: string;
      coordinates: number[][][] | number[][][][];
    };
    // Polygon → coordinates[0] is the outer ring; MultiPolygon → first polygon.
    const ring = (
      geo.type === "MultiPolygon"
        ? (geo.coordinates[0] as number[][][])[0]
        : (geo.coordinates as number[][][])[0]
    ) as number[][] | undefined;
    if (!ring) return null;
    return ring.map(([x, y]) => [x, y] as [number, number]);
  } catch {
    return null;
  }
}

/** A row of the streamhub `geofences` table, as read for the places map. */
export interface StreamhubGeofenceRow {
  geofence_id: number;
  client_geofence_id: string | null;
  geofence_name: string | null;
  polygon_type: string | null;
  /** EWKB hex (Multi)Polygon; circles are stored already as polygons. */
  coordinates: string | null;
  /** Free-form JSON: `category`, `address`, `radius_meters`, … */
  properties: Record<string, unknown> | null;
}

/**
 * Every geofence of one streamhub client (`client_id`, the Auth0 M2M client
 * that owns it). Read-only: the places map loads them, nothing writes back.
 */
export async function fetchClientGeofences(
  clientId: string
): Promise<StreamhubGeofenceRow[]> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/geofences?select=geofence_id,client_geofence_id,geofence_name,polygon_type,coordinates,properties&client_id=eq.${encodeURIComponent(
    clientId
  )}&order=geofence_name.asc`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET geofences failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as StreamhubGeofenceRow[];
}

export interface GeofenceCentroid {
  /** The geofence's client id — matches a service's origen/destino code. */
  code: string;
  latitude: number;
  longitude: number;
}

/**
 * Resolve geofence client-ids (the values a service carries as
 * origin/destination — `mintral_originDelegateCode` etc., e.g. "SCL" / "ANF")
 * to their polygon centroids via the streamhub `geofences` table.
 *
 * The match is on `client_geofence_id` (the upstream/client id), NOT
 * `geofence_name`: e.g. `ANF` → "SITRANS ANTOFAGASTA", `SCL` → "SITRANS
 * SANTIAGO". Codes not found (or with unparseable geometry) are omitted.
 */
export async function fetchGeofenceCentroids(
  codes: string[]
): Promise<GeofenceCentroid[]> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const token = await bearerToken();
  const inList = unique.map((c) => `"${c.replaceAll('"', '""')}"`).join(",");
  const url = `${pgrestBaseUrl()}/geofences?select=client_geofence_id,coordinates&client_geofence_id=in.(${encodeURIComponent(
    inList
  )})`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET geofences failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as Array<{
    client_geofence_id: string;
    coordinates: string | null;
  }>;
  const out: GeofenceCentroid[] = [];
  for (const row of rows) {
    const c = decodeEwkbPolygonCentroid(row.coordinates);
    if (c) {
      out.push({
        code: row.client_geofence_id,
        latitude: c.latitude,
        longitude: c.longitude,
      });
    }
  }
  return out;
}

/** pgrest base URL with trailing slash tolerated. */
function pgrestBaseUrl(): string {
  const raw = process.env.STREAMHUB_URL;
  if (!raw) {
    throw new Error("STREAMHUB_URL environment variable is not set");
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Fetch a fresh M2M token via the shared AuthToken singleton. The underlying
 * class caches until the JWT's `exp` and deduplicates concurrent requests.
 */
async function bearerToken(): Promise<string> {
  return getSharedAuthToken().getToken();
}

const PGREST_FETCH_TIMEOUT_MS = 30_000;

/** Thin wrapper around fetch that aborts after a timeout. */
async function pgrestFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PGREST_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `pgrest request timed out after ${PGREST_FETCH_TIMEOUT_MS}ms: ${input}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Row shape returned by `ams.fn_rd_accredited_resources`. One row per
 * resource (driver / truck / trailer / carrier) known to the tenant for the
 * given (rut_mandante, delegacion) pair. The `is_acredited` column flags the
 * resource's accreditation state — `ACCREDITED`, `NOT_ACCREDITED` or
 * `SUPER_ACCREDITED` — so the UI can surface all three.
 *
 * `trip_count` / `last_trip` are derived from `public.historical_trip`,
 * `symptoms` is a JSON rollup of `public.symptoms` over the last 90 days
 * (key: symptom_name, value: count).
 */
export type AccreditedResourceType = "DRIVER" | "TRUCK" | "TRAILER" | "CARRIER";

export interface PgrestAccreditedResourceRow {
  resource_type: AccreditedResourceType;
  resource_id: string;
  resource_name: string | null;
  identifier: string | null;
  /**
   * Upstream short code, varies by resource_type:
   * CARRIER → `prve_codigo`, DRIVER → `cond_codigo`,
   * TRUCK → `cami_matricula`, TRAILER → `remo_matricula`.
   * Used by downstream integrations (Alerce `proveedor`) where the upstream
   * code — not the RUT or plate — is the authoritative identifier.
   */
  external_id: string | null;
  faena: string | null;
  rut_mandante: string | null;
  is_acredited: "ACCREDITED" | "NOT_ACCREDITED" | "SUPER_ACCREDITED";
  trip_count: number | null;
  last_trip: string | null;
  /**
   * GPS integration flag from the upstream catalog (TRUCK rows only).
   * `INTEGRATED` means the asset has telemetry plumbing wired up, regardless
   * of whether a recent position is on file.
   */
  integration: "INTEGRATED" | "NOT INTEGRATED" | null;
  /**
   * Whether this truck runs with a trailer (TRUCK rows only): drives the
   * assignment form's trailer slot — hidden when falsy-but-present, required
   * when truthy. The upstream fn emits it as `0 | 1`; the union also admits
   * booleans so a future fn change doesn't break the contract — clients
   * normalize with `Boolean()`. Optional because older fn deployments don't
   * emit it at all; the UI treats absent/null as "required" so an unknown
   * truck can never ship an assignment whose trailer slot downstream
   * bindings would fill with a placeholder.
   */
  trailer_need?: 0 | 1 | boolean | null;
  /**
   * Last-known position as EWKB hex (SRID-prefixed point, 4326) for TRUCK
   * rows. Null when the asset has no position recorded. Decoded server-side
   * by `decodeEwkbPoint`; the calendar route surfaces the resulting
   * `latitude`/`longitude` to the client.
   */
  location: string | null;
  symptoms: Record<string, number> | null;
  updated_at: string | null;
  // Server-decoded coordinates (TRUCK rows only) — derived from `location`
  // at the route boundary so the client doesn't need a WKB decoder. Absent
  // on non-TRUCK rows or when `location` is null/malformed.
  latitude?: number | null;
  longitude?: number | null;
  heading?: number | null;
}

/**
 * Resolve the AMS-schema ingress base URL for the pgrest host. Prod exposes
 * two APISIX routes on `pgrest.streamhub.cl`:
 *
 *   - `/api/v1/pgrest/*`      → public schema
 *   - `/api/v1/pgrest-ams/*`  → ams schema (APISIX injects `Accept-Profile: ams`
 *                                and `Content-Profile: ams` for us)
 *
 * `STREAMHUB_URL` is inconsistent across envs — sometimes the bare host,
 * sometimes with the public-schema prefix. Swap the prefix if present,
 * otherwise append `/api/v1/pgrest-ams`.
 */
function amsRouteBaseUrl(): string {
  const base = pgrestBaseUrl();
  if (base.endsWith("/api/v1/pgrest")) {
    return `${base.slice(0, -"/api/v1/pgrest".length)}/api/v1/pgrest-ams`;
  }
  if (base.endsWith("/api/v1/pgrest-ams")) return base;
  return `${base}/api/v1/pgrest-ams`;
}

const ACCREDITED_RESOURCES_TTL_MS = 5 * 60 * 1000;
const ACCREDITED_RESOURCES_MAX_ENTRIES = 32;

interface AccreditedCacheEntry {
  rows: PgrestAccreditedResourceRow[];
  fetchedAt: number;
}

const accreditedResourcesCache = new Map<string, AccreditedCacheEntry>();

function accreditedCacheKey(opts: {
  rutMandante: string | null;
  delegacion: string;
  resourceType?: AccreditedResourceType;
  carrierId?: string;
}): string {
  return [
    opts.rutMandante ?? "*",
    opts.delegacion,
    opts.resourceType ?? "*",
    opts.carrierId ?? "*",
  ].join("|");
}

/**
 * Fetch the *full* accredited-resources set for the given scope. Bypasses
 * pagination — the server-side slicing happens in the route handler on top of
 * this cached array, since the upstream function does not take `limit/offset`
 * and re-running the heavy JSONB aggregation per scroll tick would be wasteful.
 *
 * Results are cached in-process for {@link ACCREDITED_RESOURCES_TTL_MS}. The
 * cache is a tiny bounded Map (eldest entry evicted once full) — accreditation
 * changes rarely, so staleness up to 5 min is acceptable.
 *
 * `p_client_id` is pinned to `"mintral"` at the source — the tenant split is
 * not yet modeled on the ams function and hardcoding matches what the rest of
 * this feature expects.
 */
export async function fetchAccreditedResources(opts: {
  rutMandante: string | null;
  delegacion: string;
  resourceType?: AccreditedResourceType;
  /**
   * Optional CARRIER `resource_id` that scopes child rows (e.g. DRIVER) to a
   * specific transportist. Maps to the upstream function's `p_carrier_id`.
   */
  carrierId?: string;
}): Promise<PgrestAccreditedResourceRow[]> {
  const key = accreditedCacheKey(opts);
  const cached = accreditedResourcesCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ACCREDITED_RESOURCES_TTL_MS) {
    return cached.rows;
  }

  const token = await bearerToken();
  const url = `${amsRouteBaseUrl()}/rpc/fn_rd_accredited_resources`;
  const body: Record<string, unknown> = {
    p_client_id: "mintral",
    // Contract preserved: `p_rut_mandante` is always sent. It is `null` when
    // the service carries no client RUT — the upstream function must treat
    // null as "no mandante filter" (return the full delegacion scope).
    p_rut_mandante: opts.rutMandante,
    p_delegacion: opts.delegacion,
  };
  if (opts.resourceType) body.p_resource_type = opts.resourceType;
  if (opts.carrierId) body.p_carrier_id = opts.carrierId;
  const response = await pgrestFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest POST rpc/fn_rd_accredited_resources failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as PgrestAccreditedResourceRow[];

  // Bounded LRU-ish eviction: drop eldest insertion when full.
  if (accreditedResourcesCache.size >= ACCREDITED_RESOURCES_MAX_ENTRIES) {
    const eldest = accreditedResourcesCache.keys().next().value;
    if (eldest !== undefined) accreditedResourcesCache.delete(eldest);
  }
  accreditedResourcesCache.set(key, { rows, fetchedAt: Date.now() });
  return rows;
}

/** Drop the cached entry — used when the route wants to bypass TTL on demand. */
export function invalidateAccreditedResourcesCache(opts?: {
  rutMandante: string | null;
  delegacion: string;
  resourceType?: AccreditedResourceType;
  carrierId?: string;
}): void {
  if (!opts) {
    accreditedResourcesCache.clear();
    return;
  }
  accreditedResourcesCache.delete(accreditedCacheKey(opts));
}

// --- pgrest drivers (collaborators) view helpers. ---
// See .cursor/plans/collaborators_management_integration.plan.md for the
// mapping rules and the caveats about the `_tmp` stub view.

/**
 * Escape a user-supplied search term for PostgREST `ilike` filters.
 *
 * PostgREST's filter query-string grammar uses `,` and `()` as delimiters and
 * `*` as the wildcard, so an unescaped value containing any of those would
 * either break the query or inject filters. We strip them out. The remaining
 * characters are URL-encoded by the caller via `encodeURIComponent`.
 */
function sanitizePgrestSearchTerm(term: string): string {
  return term.replaceAll(/[,()*]/g, "").trim();
}

/**
 * Fetch rows from `public.v_modulariot_drivers_tmp` visible to the token's
 * tenant. When `q` is provided, applies a case-insensitive OR match across
 * `name_driver`, `cust_account`, and `cod_driver` — the three text columns
 * that can plausibly carry a name or a RUT-like identifier in this view.
 *
 * There is no driver RUT column on this view, so the "search by RUT"
 * requirement falls back to matching `cust_account` (customer RUT).
 *
 * The view is small (~334 rows) so we fetch everything and let the frontend
 * paginate; no server-side pagination is wired yet.
 */
export async function fetchDriversFromView(opts?: {
  q?: string;
  /** When set, restrict results to drivers whose `cust_account` is in this list. */
  custAccounts?: string[];
}): Promise<PgrestDriverRow[]> {
  const token = await bearerToken();
  const params = new URLSearchParams();
  params.set("order", "id.asc");

  // Tenant scope filter — restricts to the active org's effective tax ids.
  if (opts?.custAccounts && opts.custAccounts.length > 0) {
    if (opts.custAccounts.length === 1) {
      params.set("cust_account", `eq.${opts.custAccounts[0]}`);
    } else {
      params.set("cust_account", `in.(${opts.custAccounts.join(",")})`);
    }
  }

  const rawTerm = opts?.q?.trim();
  if (rawTerm) {
    const safe = sanitizePgrestSearchTerm(rawTerm);
    if (safe.length > 0) {
      const pattern = `*${safe}*`;
      // PostgREST `or=` composite filter — matches any of the listed columns.
      params.set(
        "or",
        `(name_driver.ilike.${pattern},cust_account.ilike.${pattern},cod_driver.ilike.${pattern})`
      );
    }
  }

  const url = `${pgrestBaseUrl()}/v_modulariot_drivers_tmp?${params.toString()}`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      "Range-Unit": "items",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET v_modulariot_drivers_tmp failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as PgrestDriverRow[];
}

/**
 * Fetch a single driver row by its numeric `id`. Returns `null` when no row
 * matches. Used by the detail page so the list response doesn't have to be
 * round-tripped just to render one card.
 */
export async function fetchDriverById(
  id: string | number
): Promise<PgrestDriverRow | null> {
  const numeric = Number(id);
  if (!Number.isInteger(numeric)) return null;
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/v_modulariot_drivers_tmp?id=eq.${numeric}&limit=1`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      "Range-Unit": "items",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET v_modulariot_drivers_tmp (id=eq.${numeric}) failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as PgrestDriverRow[];
  return rows[0] ?? null;
}

/**
 * Transform a raw `v_modulariot_drivers_tmp` row into the existing
 * `Collaborator` shape consumed by the grid and detail components.
 *
 * Field mapping decisions (see plan file for the full justification):
 *
 * - `id` is stringified — the `Collaborator` contract expects string ids.
 * - `employmentStatus` maps `is_active` → `"activo" | "suspendido"`. The
 *   view has no third state, so `"vacaciones"` is never emitted.
 * - `department` surfaces `cust_account` (customer RUT) because it's the
 *   closest thing to a company/department identifier the view provides.
 *   Null collapses to an empty string.
 * - `rank` defaults to `"conductor"` — the view has no rank column.
 * - `email`, `punctuality`, `safety`, `incidentsCount` default to empty/zero;
 *   they'll come from richer endpoints in a later phase.
 * - `score` is a plain numeric copy. Today every row is `0` upstream.
 */
export function driverRowToCollaborator(row: PgrestDriverRow): Collaborator {
  return {
    id: String(row.id),
    // `externalId` carries the cod_driver (`{id}-{patente}`) so the list
    // page can route straight to `/collaborators-management/{externalId}`
    // without a second lookup. See `api_detalle_expediente_colaborador`
    // which takes `p_cod_driver` verbatim.
    externalId: row.cod_driver,
    name: row.name_driver,
    email: "",
    rank: "conductor",
    department: row.cust_account ?? "",
    score: Number(row.score_driver),
    employmentStatus: row.is_active ? "activo" : "suspendido",
    punctuality: 0,
    safety: 0,
    incidentsCount: 0,
    assignedVehiclePlate: row.patente_actual,
  };
}

/**
 * Response shape returned by `public.api_detalle_expediente_colaborador`
 * in prod-iot-gps. One JSON object (not an array) containing the driver
 * header plus three pre-shaped sub-payloads that map 1:1 onto the
 * frontend's `CollaboratorDetailData` type.
 *
 * Caveats (see .cursor/plans/collaborator_detail_page_integration.plan.md):
 *
 * - `scores` contains 6 entries in positional order matching the
 *   frontend's `SCORE_CARD_CONFIG`, but the `FilterType` enum only has 5
 *   values, so positions 1 and 2 (punctuality + operational efficiency)
 *   both carry `id: "todos"` as a placeholder. The `CollaboratorDetailView`
 *   merges by array index, so rendering is unaffected — the duplicate id
 *   only matters if the score card ever becomes a click-through to a
 *   behavior-history filter.
 * - `behaviorEvents.date` is a pre-formatted Spanish-locale string
 *   ("05/04/2026, 14:32"), not ISO. Pass-through today; negotiate an ISO
 *   field server-side when the UI needs locale-aware formatting.
 */
export interface PgrestDriverDetailResponse {
  driver: PgrestDriverRow;
  scores: CollaboratorDetailData["scores"];
  behaviorEvents: CollaboratorDetailData["behaviorEvents"];
  monthlyEvolution: CollaboratorDetailData["monthlyEvolution"];
}

/**
 * Call `public.api_detalle_expediente_colaborador(p_cod_driver => <cod>)`
 * via pgrest RPC and return the full expediente payload, or `null` when
 * the function returns nothing (non-existent cod_driver). Unlike the
 * other `rpc/*` helpers the response is a single JSON object — not an
 * array — so we don't `[0] ?? null` the body.
 *
 * pgrest exposes this RPC over GET with the arg as a query string, so
 * we use GET to make the response cache-friendly. The other RPCs are
 * POSTed, but GET works for read-only SECURITY DEFINER functions with
 * primitive args like this one.
 */
export async function fetchDriverDetailByCodDriver(
  codDriver: string
): Promise<PgrestDriverDetailResponse | null> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/rpc/api_detalle_expediente_colaborador?p_cod_driver=${encodeURIComponent(
    codDriver
  )}`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `pgrest GET rpc/api_detalle_expediente_colaborador (${codDriver}) failed: ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as PgrestDriverDetailResponse | null;
  // Defensive: some pgrest RPC errors return 200 + null body.
  if (!body?.driver) return null;
  return body;
}

/**
 * Transform the raw expediente response into the `CollaboratorDetailDto`
 * consumed by the detail page. The header rides on `driverRowToCollaborator`
 * (same adapter the list uses, so the header stays consistent with the
 * list card), and the three sub-arrays pass through unchanged because the
 * backend already shapes them to match the frontend types.
 *
 * `collaboratorId` is the list-shaped numeric id (stringified), matching
 * how the mock data service identifies drivers internally.
 */
export function driverDetailResponseToDto(
  resp: PgrestDriverDetailResponse
): CollaboratorDetailDto {
  const collaborator = driverRowToCollaborator(resp.driver);
  return {
    collaborator,
    detailData: {
      collaboratorId: collaborator.id,
      scores: resp.scores ?? [],
      monthlyEvolution: resp.monthlyEvolution ?? [],
      behaviorEvents: resp.behaviorEvents ?? [],
    },
  };
}
