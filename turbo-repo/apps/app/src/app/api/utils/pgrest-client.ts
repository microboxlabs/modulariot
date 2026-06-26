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
import wkx from "wkx";
import type { Tenant, Truck } from "@microboxlabs/miot-resource-client";
import type { TruckMaintenanceDetail } from "@/features/fleet-management/types/truck-maintenance.types";
import type {
  TelemetryCapabilities,
  TruckTelemetryDetail,
} from "@/features/fleet-management/types/truck-telemetry.types";
import type {
  TruckEventItem,
  TruckEventsDetail,
} from "@/features/fleet-management/types/truck-events.types";
import type {
  ContractDeviation,
  TruckUsageDetail,
  UsageIntensity,
} from "@/features/fleet-management/types/truck-usage.types";
import type {
  Collaborator,
  CollaboratorDetailData,
  CollaboratorDetailDto,
} from "@/features/collaborators-management/types/collaborators.types";
import { getSharedAuthToken } from "./streamhub-api-client";

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
  cust_account: string | null;
  /** 0/1 flag from the catalog: 1 means the vehicle is currently in service. */
  en_mantencion: number | null;
}

export interface PgrestMapPositionRow {
  asset_id: string;
  timestamp: string | null;
  location: string | null; // EWKB hex
  speed: number | null;
  heading: number | null;
  gps_provider: string | null;
}

/**
 * Row shape returned by `public.fn_dx_mantenimiento_detalle` in prod-iot-gps.
 * Mirrors the 22 columns of the function's RETURNS TABLE definition verbatim.
 * The backing data comes from `ams.gama_temp_datos_preliminar` plus the
 * `dx_vehicle_current` rollup — see `db-scripts/plans/fleet-maintenance-state.md`
 * for the underlying tables and derivation rules.
 */
export interface PgrestMaintenanceRow {
  rent_id: string | null;
  patente: string;
  /** Display label (e.g. "SWJK62 — Citroen BERLINGO ... · 2023"). Unused by the UI. */
  vehiculo: string | null;
  description: string | null;
  brand_id: string | null;
  model_year: number | null;
  /** Current odometer in km. NULL means the upstream has no signal (SIN_INFO). */
  km_actual: number | null;
  /** Odometer at the last closed work order; 0 means the vehicle has never been serviced. */
  km_os: number | null;
  /** Contractual maintenance interval in km. */
  freq: number | null;
  /** Remaining km vs manufacturer interval. */
  km_rest_fab: number | null;
  /** Remaining km since last service. */
  km_rest_os: number | null;
  /** Effective remaining km — `LEAST(km_rest_fab, km_rest_os)` when serviced, else `km_rest_fab`. */
  km_rest_peor: number | null;
  /**
   * Target odometer for the next scheduled service.
   * Computed upstream as `km_actual + km_rest_peor` so it lands on the
   * next round interval (e.g. 90000 when `km_actual=88501` and
   * `km_rest_peor=1499`). Replaces the older `km_next_maintance`.
   */
  prox_mant_km: number | null;
  /** ABS of `km_rest_peor` when it goes negative; NULL when not overdue. */
  km_excedido: number | null;
  /** 7-day rolling average km/day. May be 0 or NULL. */
  km_por_dia: number | null;
  /** Projected days remaining; NULL when `km_por_dia` is 0/NULL. */
  dias_est: number | null;
  /** Projected service date in ISO (`YYYY-MM-DD`); NULL when `dias_est` is NULL. */
  fecha_est: string | null;
  /** Current open work order state: 'EN_TALLER' / 'AGENDADO' / NULL. */
  estado_os: string | null;
  dias_en_status: number | null;
  /** 7-value enum — see README below. */
  criticidad:
    | "AL_DIA"
    | "POR_VENCER"
    | "CRITICO"
    | "VENCIDO"
    | "EN_TALLER"
    | "AGENDADO"
    | "SIN_INFO";
}

/**
 * Row shape returned by `public.fn_dx_senal_detalle` in prod-iot-gps.
 * Mirrors the 33 columns of the function's RETURNS TABLE definition.
 * Sourced from `asset_data_client` signal rollups plus the pgrest
 * catalog for identity columns. The 7-day lookback window is fixed by
 * `p_lookback_days` (default 7). `last_*` fields are only populated
 * when the matching `has_*` capability flag is true.
 */
export interface PgrestSignalRow {
  rent_id: string | null;
  patente: string;
  vehiculo: string | null;
  brand_id: string | null;
  model_year: number | null;
  /** Timestamp of the most recent signal; null when SIN_SENAL. */
  ultima_senal: string | null;
  /** Hours since last signal; large numbers or null when SIN_SENAL. */
  horas_sin_senal: number | null;
  total_senales_7d: number | null;
  senales_por_dia: number | null;
  /** Instantaneous pulse rate (pulses / minute); null when SIN_SENAL. */
  pulsos_por_minuto: number | null;
  /**
   * Human-readable location label of the last signal; null when unknown.
   * Name preserves the upstream typo (`ubication` vs `ubicacion`).
   */
  ubication: string | null;
  // Per-metric capability flags — true when the device reports this metric.
  has_vehicle_speed: boolean;
  has_odometer: boolean;
  has_engine_rpm: boolean;
  has_fuel_level: boolean;
  has_coolant_temp: boolean;
  has_battery_v: boolean;
  has_engine_load: boolean;
  has_throttle: boolean;
  has_engine_runtime: boolean;
  /** Count of CAN metrics with has_*=true. */
  metricas_can: number | null;
  /** Overall telemetry score in [0,100]. */
  score_telemetria: number | null;
  /** 3-value enum: 'ACTIVO' | 'REZAGADO' | 'SIN_SENAL'. */
  frescura: "ACTIVO" | "REZAGADO" | "SIN_SENAL";
  /** 4-value enum: 'OPTIMO' | 'ACEPTABLE' | 'DEGRADADO' | 'SIN_SENAL'. */
  salud_gps: "OPTIMO" | "ACEPTABLE" | "DEGRADADO" | "SIN_SENAL";
  /** GPS provider display name — upstream is dirty ('Redd' vs 'REDD GPS'). */
  proveedor_gps: string | null;
  /** Signal stability percentage [0,100]. */
  pct_estabilidad: number | null;
  // Last-known sensor values. Null when the matching has_* flag is false.
  last_vehicle_speed_kph: number | null;
  last_engine_rpm: number | null;
  last_coolant_temp_c: number | null;
  last_fuel_level_pct: number | null;
  /** Battery voltage in millivolts — the adapter converts to volts. */
  last_battery_voltage_mv: number | null;
  last_engine_load_pct: number | null;
  last_throttle_pos_pct: number | null;
  last_engine_runtime_h: number | null;
  last_odometer_km: number | null;
}

/**
 * Row shape returned by `public.fn_dx_uso_flota_detalle` in prod-iot-gps.
 * The function was shrunk from 18 to 11 columns — see
 * `vehicle_usage_detail_schema_shrink.plan.md` for the full diff and
 * `fix-usage-data.md` for the backend team's handoff.
 *
 * `max_travel` is the **lifetime** contract allowance (not monthly), and
 * `pct_consumido` / `desviacion_km` are cumulative against it. Only
 * `km_periodo` / `promedio_diario` use the rolling date-range window
 * (default 30 days via `p_desde` / `p_hasta`).
 *
 * Fields that used to exist but are now derived client-side in
 * `usageRowToDto`: `has_odometer` (from `km_actual !== null`) and
 * `desviacion_contrato` (via `deriveContractStatus`). `dias_con_dato`
 * was dropped without replacement — the DTO carries `null` for
 * `active_days` until the backend re-exposes it as a 12th column.
 */
export interface PgrestUsageRow {
  rent_id: string | null;
  patente: string;
  /** Display label, unused — already on the Vehicle object. */
  vehiculo: string | null;
  /** Use-type category from the upstream catalog ("Mixed", "Urbano", ...). */
  gm_use_type: string | null;
  /** Current odometer (km). NULL when the upstream has no distance signal. */
  km_actual: number | null;
  /** Contractual lifetime allowance (km). */
  max_travel: number;
  /** Cumulative contract consumption 0–100+. NULL when SIN_DATOS. */
  pct_consumido: number | null;
  /** km traveled in the rolling window (default 30 days). */
  km_periodo: number | null;
  /** Rolling km/day across the window. NULL when there's no signal. */
  promedio_diario: number | null;
  /** Signed: `km_actual - max_travel`. NULL when SIN_DATOS. */
  desviacion_km: number | null;
  /** 4-value enum — see UsageIntensity. */
  intensidad: UsageIntensity;
}

/**
 * Row shape returned by `public.fn_dx_eventos_detalle` in prod-iot-gps.
 * One row per operational event (symptom) for a single vehicle within the
 * lookback window. `p_patente` is required by the function.
 */
export interface PgrestEventRow {
  evento_id: number;
  timestamp_evento: string;
  categoria: string;
  symptom_name: string;
  duracion_minutos: number | null;
  severidad: "Bajo" | "Medio" | "Alto" | "Crítico";
  icu_code: number;
  velocidad_detectada: number | null;
  limite_velocidad: number | null;
  signal_lag: string | null;
  accumulated_signals: number | null;
  detalle: Record<string, unknown> | null;
  tiene_treatment: boolean;
  treatment_status: string | null;
  treatment_type: string | null;
  message: string;
}

/** Row shape for ams.fleet_special_views — see db-scripts migration. */
export interface PgrestFleetSpecialViewRow {
  id: number;
  client_id: string;
  position: number;
  active: boolean;
  icon: string;
  icon_color: string;
  icon_color_dark: string;
  title_es: string;
  title_en: string;
  description_es: string | null;
  description_en: string | null;
  badge_text_es: string | null;
  badge_text_en: string | null;
  badge_color: string | null;
  badge_color_dark: string | null;
  route: string;
}

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
  if (!hex) return null;
  const clean = hex.replace(/^(\\x|0x)/i, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean))
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
  } catch {
    return null;
  }
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
 * Fetch rows from `v_modulariot_trucks_tmp`. When `custAccounts` is provided,
 * restricts results to trucks whose `cust_account` is in the list (multi-tenant
 * filtering). Otherwise returns everything visible to the token's tenant.
 */
export async function fetchTrucksCatalog(opts?: {
  custAccounts?: string[];
}): Promise<PgrestTruckCatalogRow[]> {
  const token = await bearerToken();
  const params = new URLSearchParams();

  if (opts?.custAccounts && opts.custAccounts.length > 0) {
    // custAccounts are backend-validated Chilean RUTs normalized by
    // ChileanRutValidator to \d{7,8}-[0-9K], so direct PostgREST
    // eq./in.(...) interpolation is safe from delimiter injection. Keep
    // that source/validation invariant if these filters are refactored.
    if (opts.custAccounts.length === 1) {
      params.set("cust_account", `eq.${opts.custAccounts[0]}`);
    } else {
      params.set("cust_account", `in.(${opts.custAccounts.join(",")})`);
    }
  }

  const qs = params.toString();
  const querySuffix = qs ? `?${qs}` : "";
  const url = `${pgrestBaseUrl()}/v_modulariot_trucks_tmp${querySuffix}`;
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
      `pgrest GET v_modulariot_trucks_tmp failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as PgrestTruckCatalogRow[];
}

/**
 * Fetch a single truck catalog row by its numeric `mbl_id` or license plate
 * (`patente`). Returns `null` when no row matches. The caller decides which
 * column to query based on whether the identifier parses as an integer.
 */
export async function fetchTruckCatalogByIdOrPlate(
  idOrPlate: string
): Promise<PgrestTruckCatalogRow | null> {
  const token = await bearerToken();
  const numeric = Number(idOrPlate);
  const filter = Number.isInteger(numeric)
    ? `mbl_id=eq.${numeric}`
    : `patente=eq.${encodeURIComponent(idOrPlate)}`;
  const url = `${pgrestBaseUrl()}/v_modulariot_trucks_tmp?${filter}&limit=1`;
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
      `pgrest GET v_modulariot_trucks_tmp (${filter}) failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as PgrestTruckCatalogRow[];
  return rows[0] ?? null;
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

/**
 * Fetch the active special-view cards for the current tenant from
 * `ams.fleet_special_views`. Tenant filtering is enforced server-side via
 * the table's RLS policy on the JWT `azp` claim, so no client_id is sent.
 *
 * Uses the `Accept-Profile: ams` header (PostgREST schema selection) since
 * this table lives outside the default `public` schema.
 */
export async function fetchSpecialViews(): Promise<
  PgrestFleetSpecialViewRow[]
> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/fleet_special_views?active=eq.true&order=position`;
  const response = await pgrestFetch(url, {
    headers: {
      accept: "application/json",
      "Accept-Profile": "ams",
      "Range-Unit": "items",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest GET ams.fleet_special_views failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as PgrestFleetSpecialViewRow[];
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
  const response = await pgrestFetch(url, {
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

/**
 * Call `public.fn_dx_mantenimiento_detalle(p_asset_id => <plate>)` via pgrest
 * RPC and return the single matching row, or `null` when the plate has no
 * entry in the upstream `ams.gama_temp_datos_preliminar`.
 *
 * The function accepts several parameters but we only filter by plate —
 * `p_shared_client_id` defaults to the Gama tenant (row-level security is
 * enforced upstream on the underlying tables), `p_lookback_days` is accepted
 * but unused by the function body, and `p_solo_piloto` stays `false` so all
 * ~334 trucks are covered, not just the 54-plate pilot list.
 */
export async function fetchTruckMaintenanceDetailByPlate(
  plate: string
): Promise<PgrestMaintenanceRow | null> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/rpc/fn_dx_mantenimiento_detalle`;
  const response = await pgrestFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_asset_id: plate }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest POST rpc/fn_dx_mantenimiento_detalle failed: ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as PgrestMaintenanceRow[];
  return body[0] ?? null;
}

/**
 * Call `public.fn_dx_senal_detalle(p_asset_id => <plate>)` via pgrest RPC
 * and return the single matching row, or `null` when no signal row exists
 * for the plate in the 7-day lookback window.
 *
 * Same parameter handling as the maintenance fetcher — `p_shared_client_id`
 * keeps its default (RLS is enforced upstream), `p_lookback_days` keeps
 * its default (7), and we only pass the plate filter.
 */
export async function fetchTruckSignalDetailByPlate(
  plate: string
): Promise<PgrestSignalRow | null> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/rpc/fn_dx_senal_detalle`;
  const response = await pgrestFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_asset_id: plate }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest POST rpc/fn_dx_senal_detalle failed: ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as PgrestSignalRow[];
  return body[0] ?? null;
}

// --- pgrest row → resource-client `Truck` transformation helpers. ---
// Shared between the list route and the single-truck route so both sources
// produce identical shapes. Kept here because they are tightly coupled to
// the pgrest row types above.

/** Stubbed Tenant — pgrest does not expose tenant metadata; unused downstream. */
const PGREST_TENANT_STUB: Tenant = {
  id: 0,
  code: "pgrest",
  name: "pgrest",
  active: true,
};

function mapPgrestStatus(row: PgrestTruckCatalogRow): string {
  if (!row.is_active) return "INACTIVE";
  // The catalog's en_mantencion flag is the authoritative maintenance signal;
  // it overrides whatever the free-form `status` text says.
  if (row.en_mantencion === 1) return "MAINTENANCE";
  const s = (row.status ?? "").toUpperCase();
  if (s.includes("MAINTEN")) return "MAINTENANCE";
  if (s.includes("ALERT") || s.includes("WARNING")) return "ALERT";
  return "ACTIVE";
}

type MetricValue = string | number | boolean | null;

function addPositionMetrics(
  metrics: Record<string, MetricValue>,
  position: PgrestMapPositionRow
): void {
  if (position.timestamp) metrics.timestamp = position.timestamp;
  if (position.speed != null) metrics.vehicle_speed_kph = position.speed;
  if (position.heading != null) metrics.heading = position.heading;
  if (position.gps_provider != null)
    metrics.gps_provider = position.gps_provider;
  const point = decodeEwkbPoint(position.location);
  if (point) {
    metrics.latitude = point.latitude;
    metrics.longitude = point.longitude;
  }
}

function buildLatestMetricsFromPgrest(
  row: PgrestTruckCatalogRow,
  position: PgrestMapPositionRow | undefined
): Record<string, MetricValue> {
  const metrics: Record<string, MetricValue> = {};

  if (row.device_usage_qty != null) {
    metrics.odometer_km = row.device_usage_qty;
  }
  if (row.maintenance_frequency != null) {
    metrics.maintenance_frequency_km = row.maintenance_frequency;
  }
  // Human-readable city/location label from the pgrest catalog, used by the
  // fleet card instead of raw lat/lon when present.
  if (row.ubicacion && row.ubicacion.trim() !== "") {
    metrics.location_label = row.ubicacion.trim();
  }
  // Customer account (RUT) from the pgrest catalog — surfaced as the
  // transportist/client on the card until a proper name field is exposed.
  if (row.cust_account && row.cust_account.trim() !== "") {
    metrics.customer_account = row.cust_account.trim();
  }

  if (position) {
    addPositionMetrics(metrics, position);
  }

  return metrics;
}

/**
 * Convert a pgrest truck catalog row (plus optional last-known position)
 * into the `Truck` shape emitted by the resource client. Both fleet routes
 * call this so their responses stay identical regardless of the source.
 */
export function pgrestRowToTruck(
  row: PgrestTruckCatalogRow,
  position: PgrestMapPositionRow | undefined,
  clientId: string
): Truck {
  return {
    id: row.mbl_id,
    tenant: PGREST_TENANT_STUB,
    clientId,
    entityId: String(row.mbl_id),
    externalId: row.patente,
    status: mapPgrestStatus(row),
    alfrescoNodeId: "",
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    licensePlate: row.patente,
    vin: row.chassis_number ?? "",
    brand: row.brand_id ?? "",
    model: row.description ?? "",
    year: row.model_year ?? 0,
    maxWeight: 0,
    volume: 0,
    truckType: row.type_id ?? row.group_id ?? "",
    assetId: row.patente,
    latestMetrics: buildLatestMetricsFromPgrest(row, position),
  };
}

// --- pgrest maintenance row → DTO adapter. ---
// Lives here alongside the row type so null-handling rules stay in one place.
// The DTO shape is the public contract shared with the frontend hook and the
// future Java endpoint — see truck-maintenance.types.ts.

/**
 * Transform a raw `fn_dx_mantenimiento_detalle` row into the DTO consumed by
 * the UI. Null-handling rules (the reason this is not a trivial field copy):
 *
 * - `km_actual IS NULL` → `SIN_INFO` upstream; we echo that by leaving
 *   `odometer.current_km` null and making every odometer-dependent derivation
 *   also null (`km_since_last_service`, `pct_of_interval`).
 * - `km_os = 0` → never serviced; the source still returns zero but the UI
 *   must treat this as "no prior service", so `last_service_km` becomes
 *   null even though the row may carry a value.
 * - `km_por_dia = 0 OR NULL` → the source returns null `dias_est`/`fecha_est`
 *   already; we pass those through untouched.
 *
 * `plan.last_service_at` and `plan.completed_services` are forced to null
 * because the upstream function dropped those columns. See #298.
 */
export function maintenanceRowToDto(
  row: PgrestMaintenanceRow
): TruckMaintenanceDetail {
  const intervalKm = row.freq ?? 0;
  const lastServiceKm = row.km_os && row.km_os > 0 ? row.km_os : null;

  const kmSinceLastService =
    row.km_actual !== null && lastServiceKm !== null
      ? row.km_actual - lastServiceKm
      : null;

  const pctOfInterval =
    kmSinceLastService !== null && intervalKm > 0
      ? Math.round((kmSinceLastService / intervalKm) * 100)
      : null;

  return {
    plate: row.patente,
    contract_external_id: row.rent_id,
    odometer: {
      current_km: row.km_actual,
      km_per_day_7d:
        row.km_por_dia !== null && row.km_por_dia > 0
          ? Number(row.km_por_dia)
          : null,
    },
    plan: {
      interval_km: intervalKm,
      last_service_km: lastServiceKm,
      last_service_at: null, // #298

      next_service_target_km: row.prox_mant_km ?? intervalKm,
      completed_services: null, // #298

      km_since_last_service: kmSinceLastService,
      pct_of_interval: pctOfInterval,
    },
    remaining: {
      km_effective: row.km_rest_peor,
      km_overdue: row.km_excedido,
    },
    forecast: {
      estimated_days_remaining:
        row.dias_est === null ? null : Math.round(Number(row.dias_est)),
      estimated_service_date: row.fecha_est,
    },
    work_order: {
      status:
        row.estado_os === "EN_TALLER" || row.estado_os === "AGENDADO"
          ? row.estado_os
          : null,
      days_in_status: row.dias_en_status,
    },
    status: {
      criticality: row.criticidad,
    },
  };
}

// --- pgrest signal row → DTO adapter. ---
// Shared by the /telemetry route; see truck-telemetry.types.ts for the
// DTO contract.

/**
 * Build the `capabilities` object by checking each `has_<metric>` flag and
 * pulling the matching `last_<metric>` value. Only non-null values are
 * added — a key that is absent means the device doesn't report that
 * metric, distinct from "we have a capability but the latest value is
 * zero". Battery voltage is converted from millivolts to volts here so
 * the UI never has to deal with raw mV.
 */
function addCapability<K extends keyof TelemetryCapabilities>(
  caps: TelemetryCapabilities,
  key: K,
  hasFlag: boolean,
  value: number | null,
  transform?: (v: number) => number
): void {
  if (hasFlag && value !== null) {
    caps[key] = transform ? transform(value) : value;
  }
}

function buildTelemetryCapabilities(
  row: PgrestSignalRow
): TelemetryCapabilities {
  const caps: TelemetryCapabilities = {};
  addCapability(
    caps,
    "vehicle_speed_kph",
    row.has_vehicle_speed,
    row.last_vehicle_speed_kph
  );
  addCapability(caps, "odometer_km", row.has_odometer, row.last_odometer_km);
  addCapability(caps, "engine_rpm", row.has_engine_rpm, row.last_engine_rpm);
  addCapability(
    caps,
    "fuel_level_pct",
    row.has_fuel_level,
    row.last_fuel_level_pct,
    Number
  );
  addCapability(
    caps,
    "coolant_temp_c",
    row.has_coolant_temp,
    row.last_coolant_temp_c
  );
  addCapability(
    caps,
    "battery_voltage_v",
    row.has_battery_v,
    row.last_battery_voltage_mv,
    (mv) => mv / 1000
  );
  addCapability(
    caps,
    "engine_load_pct",
    row.has_engine_load,
    row.last_engine_load_pct
  );
  addCapability(
    caps,
    "throttle_pos_pct",
    row.has_throttle,
    row.last_throttle_pos_pct
  );
  addCapability(
    caps,
    "engine_runtime_h",
    row.has_engine_runtime,
    row.last_engine_runtime_h
  );
  return caps;
}

/**
 * Transform a raw `fn_dx_senal_detalle` row into the DTO consumed by the
 * telemetry card. Null-handling rules:
 *
 * - `SIN_SENAL` rows typically have null `ultima_senal`, `horas_sin_senal`,
 *   and `pct_estabilidad`; these pass through as null and the UI renders
 *   the empty-state banner.
 * - `proveedor_gps === "Sin proveedor"` collapses to null so the UI can
 *   show a localized placeholder instead of echoing the literal string.
 * - `capabilities` only contains keys whose `has_*` flag is true and whose
 *   `last_*` value is non-null. Missing keys are semantically "this device
 *   doesn't report that metric".
 * - Battery voltage is converted from the source's millivolts to volts
 *   here (see `buildTelemetryCapabilities`) so the frontend never touches
 *   raw mV.
 */
export function signalRowToDto(row: PgrestSignalRow): TruckTelemetryDetail {
  const provider = row.proveedor_gps?.trim();
  const ubication = row.ubication?.trim();
  return {
    plate: row.patente,
    location: ubication && ubication.length > 0 ? ubication : null,
    signal: {
      last_at: row.ultima_senal,
      hours_since_last:
        row.horas_sin_senal === null ? null : Number(row.horas_sin_senal),
      total_last_7d: row.total_senales_7d ?? 0,
      signals_per_day:
        row.senales_por_dia === null ? 0 : Number(row.senales_por_dia),
      pulses_per_minute:
        row.pulsos_por_minuto == null ? null : Number(row.pulsos_por_minuto),
      stability_pct:
        row.pct_estabilidad === null ? null : Number(row.pct_estabilidad),
      freshness: row.frescura,
    },
    gps: {
      provider:
        provider && provider.length > 0 && provider !== "Sin proveedor"
          ? provider
          : null,
      health: row.salud_gps,
    },
    score: {
      telemetry:
        row.score_telemetria === null ? 0 : Number(row.score_telemetria),
      can_metrics: row.metricas_can ?? 0,
    },
    capabilities: buildTelemetryCapabilities(row),
  };
}

// --- pgrest usage row → DTO adapter. ---
// Lives alongside the row type so the SIN_DATOS null-handling rules stay in
// one place. See truck-usage.types.ts for the DTO contract.

/** Lookback window in days — matches the function's default. */
const USAGE_LOOKBACK_DAYS = 30;

/**
 * Call `public.fn_dx_uso_flota_detalle(p_asset_id => <plate>)` via pgrest
 * RPC and return the single matching row, or `null` when the plate has no
 * entry upstream. Same parameter handling as the other three helpers:
 * `p_shared_client_id` keeps its default (RLS enforced upstream), the
 * date-range window (`p_desde` / `p_hasta`) keeps its 30-day default, and
 * we only pass the plate.
 */
export async function fetchTruckUsageDetailByPlate(
  plate: string
): Promise<PgrestUsageRow | null> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/rpc/fn_dx_uso_flota_detalle`;
  const response = await pgrestFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ p_asset_id: plate }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `pgrest POST rpc/fn_dx_uso_flota_detalle failed: ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as PgrestUsageRow[];
  return body[0] ?? null;
}

/**
 * Contract-deviation classifier using the formula handed off by the
 * backend team when `fn_dx_uso_flota_detalle` was shrunk from 18 to 11
 * columns. See `fix-usage-data.md` and
 * `vehicle_usage_detail_schema_shrink.plan.md` for context.
 *
 * Rules (order matters):
 *  1. If there's no odometer reading or no contract allowance, the
 *     vehicle is `SIN_DATOS` — nothing to classify against.
 *  2. Any positive `desviacion_km` is `SOBREUSO`, regardless of the
 *     percentage. Evaluated before the 60% cutoff so a shrinking
 *     `max_travel` can still flip a vehicle into overuse.
 *  3. Consumption ≥ 60% → `NORMAL`.
 *  4. Anything below → `SUBUTILIZADO`.
 *
 * Caveat: the 60% threshold is static and does **not** consider
 * contract age. Two vehicles at 50% consumption classify the same
 * way regardless of whether one is a week old and the other is in
 * year three. The pre-shrink backend function did weigh contract age;
 * this simpler rule is the one the backend team endorsed as the
 * drop-in replacement.
 */
function deriveContractStatus(
  kmActual: number | null,
  maxTravel: number,
  deviationKm: number | null
): ContractDeviation {
  if (kmActual === null || maxTravel === 0) return "SIN_DATOS";
  if (deviationKm !== null && deviationKm > 0) return "SOBREUSO";
  const pct = kmActual / maxTravel;
  if (pct >= 0.6) return "NORMAL";
  return "SUBUTILIZADO";
}

/**
 * Transform a raw `fn_dx_uso_flota_detalle` row into the DTO consumed by
 * the UsageSection. Null-handling and derivation rules:
 *
 * - When `km_actual` is null the upstream has no distance signal at all
 *   — `pct_consumido` / `desviacion_km` / `km_periodo` / `promedio_diario`
 *   are also null and the derived `status` becomes `SIN_DATOS`.
 * - `has_odometer` is derived from `km_actual !== null`; the upstream no
 *   longer exposes a dedicated boolean.
 * - `status` is derived via `deriveContractStatus` (see above).
 * - `remaining_km` is derived from `desviacion_km`: when negative, the
 *   vehicle is within the contract so `remaining_km = |desviacion_km|`;
 *   when positive (sobreuso) the contract is exceeded so
 *   `remaining_km = 0`. **Null when `desviacion_km` is null** — we
 *   deliberately keep `null → "—"` in the UI instead of rendering
 *   "0 km restantes" for a SIN_DATOS vehicle (diverges from the BE
 *   handoff adapter on purpose).
 * - `active_days` is always `null` — `dias_con_dato` was dropped from the
 *   11-column response. If backend re-exposes it as a 12th column this
 *   becomes `row.dias_con_dato` and the UI cell starts showing values.
 * - Empty/whitespace `gm_use_type` collapses to null so the UI can show
 *   a localized placeholder.
 */
function computeRemainingKm(deviationKm: number | null): number | null {
  if (deviationKm === null) return null;
  return deviationKm < 0 ? Math.abs(deviationKm) : 0;
}

export function usageRowToDto(row: PgrestUsageRow): TruckUsageDetail {
  const useTypeRaw = row.gm_use_type?.trim();
  const useType = useTypeRaw && useTypeRaw.length > 0 ? useTypeRaw : null;

  const kmActual = row.km_actual === null ? null : Number(row.km_actual);
  const maxTravel = Number(row.max_travel);
  const deviationKm =
    row.desviacion_km === null ? null : Number(row.desviacion_km);
  const remainingKm = computeRemainingKm(deviationKm);
  const status = deriveContractStatus(kmActual, maxTravel, deviationKm);

  return {
    plate: row.patente,
    use_type: useType,
    odometer: {
      current_km: kmActual,
      has_odometer: kmActual !== null,
    },
    contract: {
      max_travel_km: maxTravel,
      pct_consumed:
        row.pct_consumido === null ? null : Number(row.pct_consumido),
      deviation_km: deviationKm,
      remaining_km: remainingKm,
      status,
    },
    period: {
      lookback_days: USAGE_LOOKBACK_DAYS,
      km_traveled: row.km_periodo === null ? null : Number(row.km_periodo),
      km_per_day:
        row.promedio_diario === null ? null : Number(row.promedio_diario),
      active_days: null,
      intensity: row.intensidad,
    },
  };
}

// --- pgrest events rows → DTO adapter. ---

/**
 * Call `public.fn_dx_eventos_detalle(p_patente => <plate>)` via pgrest RPC.
 * Returns an array (potentially large — the caller is responsible for
 * limiting). `p_patente` is mandatory; the function raises if omitted.
 *
 * `minIcuCode` defaults to 2 to filter out the massive `Bajo/SEÑAL` noise
 * (~99% of events). `limit` defaults to 50 most recent events.
 */
export async function fetchTruckEventsDetailByPlate(
  plate: string,
  opts?: {
    minIcuCode?: number;
    limit?: number;
    pDesde?: string;
    pHasta?: string;
    pTipoEvento?: string;
  }
): Promise<PgrestEventRow[]> {
  const minIcu = opts?.minIcuCode ?? 1;
  const limit = opts?.limit ?? 50;
  const token = await bearerToken();
  const clientId = getPgrestClientId();
  const url = `${pgrestBaseUrl()}/rpc/fn_dx_eventos_detalle`;

  const body: Record<string, unknown> = {
    p_shared_client_id: clientId,
    p_patente: plate,
    p_min_icu_code: minIcu,
  };
  if (opts?.pDesde) body.p_desde = opts.pDesde;
  if (opts?.pHasta) body.p_hasta = opts.pHasta;
  if (opts?.pTipoEvento) body.p_tipo_evento = opts.pTipoEvento;

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
      `pgrest POST rpc/fn_dx_eventos_detalle failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as PgrestEventRow[];
  // Sort descending by timestamp and apply the limit client-side since
  // pgrest RPC calls don't natively support ORDER BY / LIMIT headers.
  rows.sort(
    (a, b) =>
      new Date(b.timestamp_evento).getTime() -
      new Date(a.timestamp_evento).getTime()
  );
  return rows.slice(0, limit);
}

function eventRowToItem(row: PgrestEventRow): TruckEventItem {
  return {
    id: row.evento_id,
    timestamp: row.timestamp_evento,
    category: row.categoria,
    symptom_name: row.symptom_name ?? "",
    duration_minutes:
      row.duracion_minutos !== null && row.duracion_minutos > 0
        ? Number(row.duracion_minutos)
        : null,
    severity: row.severidad,
    icu_code: row.icu_code,
    speed_detected: row.velocidad_detectada,
    speed_limit: row.limite_velocidad,
    message: row.message ?? "",
    has_treatment: row.tiene_treatment,
    treatment_status: row.treatment_status,
  };
}

export function eventsRowsToDto(
  plate: string,
  rows: PgrestEventRow[]
): TruckEventsDetail {
  return {
    plate,
    events: rows.map(eventRowToItem),
  };
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
