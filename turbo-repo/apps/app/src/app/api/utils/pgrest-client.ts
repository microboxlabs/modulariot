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
      `pgrest GET v_modulariot_trucks_tmp (${filter}) failed: ${response.status} ${response.statusText}`
    );
  }
  const rows = (await response.json()) as PgrestTruckCatalogRow[];
  return rows[0] ?? null;
}

/**
 * Fetch the active special-view cards for the current tenant from
 * `ams.fleet_special_views`. Tenant filtering is enforced server-side via
 * the table's RLS policy on the JWT `azp` claim, so no client_id is sent.
 *
 * Uses the `Accept-Profile: ams` header (PostgREST schema selection) since
 * this table lives outside the default `public` schema.
 */
export async function fetchSpecialViews(): Promise<PgrestFleetSpecialViewRow[]> {
  const token = await bearerToken();
  const url = `${pgrestBaseUrl()}/fleet_special_views?active=eq.true&order=position`;
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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
  const response = await fetch(url, {
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

function buildLatestMetricsFromPgrest(
  row: PgrestTruckCatalogRow,
  position: PgrestMapPositionRow | undefined
): Record<string, string | number | boolean | null> {
  const metrics: Record<string, string | number | boolean | null> = {};

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
    if (position.timestamp) metrics.timestamp = position.timestamp;
    if (position.speed != null) metrics.vehicle_speed_kph = position.speed;
    if (position.heading != null) metrics.heading = position.heading;
    if (position.gps_provider != null) metrics.gps_provider = position.gps_provider;
    const point = decodeEwkbPoint(position.location);
    if (point) {
      metrics.latitude = point.latitude;
      metrics.longitude = point.longitude;
    }
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
 * TODO: the upstream function recently dropped `last_seen_at` and
 * `num_maintance` from its RETURNS TABLE, so `plan.last_service_at` and
 * `plan.completed_services` are forced to null here. Restore when the
 * function re-exposes them or when the Java endpoint lands.
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
        row.km_por_dia !== null && row.km_por_dia > 0 ? Number(row.km_por_dia) : null,
    },
    plan: {
      interval_km: intervalKm,
      last_service_km: lastServiceKm,
      // Source no longer ships `last_seen_at`. See TODO above.
      last_service_at: null,
      next_service_target_km: row.prox_mant_km ?? intervalKm,
      // Source no longer ships `num_maintance`. See TODO above.
      completed_services: null,
      km_since_last_service: kmSinceLastService,
      pct_of_interval: pctOfInterval,
    },
    remaining: {
      km_effective: row.km_rest_peor,
      km_overdue: row.km_excedido,
    },
    forecast: {
      estimated_days_remaining:
        row.dias_est !== null ? Math.round(Number(row.dias_est)) : null,
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
function buildTelemetryCapabilities(row: PgrestSignalRow): TelemetryCapabilities {
  const caps: TelemetryCapabilities = {};
  if (row.has_vehicle_speed && row.last_vehicle_speed_kph !== null) {
    caps.vehicle_speed_kph = row.last_vehicle_speed_kph;
  }
  if (row.has_odometer && row.last_odometer_km !== null) {
    caps.odometer_km = row.last_odometer_km;
  }
  if (row.has_engine_rpm && row.last_engine_rpm !== null) {
    caps.engine_rpm = row.last_engine_rpm;
  }
  if (row.has_fuel_level && row.last_fuel_level_pct !== null) {
    caps.fuel_level_pct = Number(row.last_fuel_level_pct);
  }
  if (row.has_coolant_temp && row.last_coolant_temp_c !== null) {
    caps.coolant_temp_c = row.last_coolant_temp_c;
  }
  if (row.has_battery_v && row.last_battery_voltage_mv !== null) {
    caps.battery_voltage_v = row.last_battery_voltage_mv / 1000;
  }
  if (row.has_engine_load && row.last_engine_load_pct !== null) {
    caps.engine_load_pct = row.last_engine_load_pct;
  }
  if (row.has_throttle && row.last_throttle_pos_pct !== null) {
    caps.throttle_pos_pct = row.last_throttle_pos_pct;
  }
  if (row.has_engine_runtime && row.last_engine_runtime_h !== null) {
    caps.engine_runtime_h = row.last_engine_runtime_h;
  }
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
  return {
    plate: row.patente,
    signal: {
      last_at: row.ultima_senal,
      hours_since_last:
        row.horas_sin_senal !== null ? Number(row.horas_sin_senal) : null,
      total_last_7d: row.total_senales_7d ?? 0,
      signals_per_day:
        row.senales_por_dia !== null ? Number(row.senales_por_dia) : 0,
      pulses_per_minute:
        row.pulsos_por_minuto !== null && row.pulsos_por_minuto !== undefined
          ? Number(row.pulsos_por_minuto)
          : null,
      stability_pct:
        row.pct_estabilidad !== null ? Number(row.pct_estabilidad) : null,
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
        row.score_telemetria !== null ? Number(row.score_telemetria) : 0,
      can_metrics: row.metricas_can ?? 0,
    },
    capabilities: buildTelemetryCapabilities(row),
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
  opts?: { minIcuCode?: number; limit?: number }
): Promise<PgrestEventRow[]> {
  const minIcu = opts?.minIcuCode ?? 2;
  const limit = opts?.limit ?? 50;
  const token = await bearerToken();
  const clientId = getPgrestClientId();
  const url = `${pgrestBaseUrl()}/rpc/fn_dx_eventos_detalle`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_shared_client_id: clientId,
      p_patente: plate,
      p_min_icu_code: minIcu,
    }),
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
