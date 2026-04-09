/**
 * DTO contract for the per-truck telemetry / signal detail, served by
 * `/app/api/fleet/trucks/[id]/telemetry`.
 *
 * v1 is backed by the pgrest shortcut against `public.fn_dx_senal_detalle`
 * in prod-iot-gps. When the long-term Java endpoint lands, this shape
 * stays identical so only the server-side handler swaps.
 */

/** Signal freshness enum — 3-value subset of `fn_dx_senal_detalle.frescura`. */
export type SignalFreshness = "ACTIVO" | "REZAGADO" | "SIN_SENAL";

/** GPS health enum — 4-value subset of `fn_dx_senal_detalle.salud_gps`. */
export type GpsHealth = "OPTIMO" | "ACEPTABLE" | "DEGRADADO" | "SIN_SENAL";

/**
 * Per-metric last-known sensor values. Only metrics whose `has_<metric>=true`
 * upstream are present as object keys — **missing keys mean the device
 * doesn't report that metric**, distinct from "the value happens to be zero".
 * Callers should iterate `Object.entries(capabilities)` and render only
 * what's present.
 */
export interface TelemetryCapabilities {
  /** km/h */
  vehicle_speed_kph?: number;
  /** km (bigint source) */
  odometer_km?: number;
  /** revolutions / minute */
  engine_rpm?: number;
  /** 0–100 */
  fuel_level_pct?: number;
  /** °C */
  coolant_temp_c?: number;
  /** volts (converted from the source's millivolts). */
  battery_voltage_v?: number;
  /** 0–100 */
  engine_load_pct?: number;
  /** 0–100 */
  throttle_pos_pct?: number;
  /** hours */
  engine_runtime_h?: number;
}

export interface TruckTelemetryDetail {
  plate: string;

  signal: {
    /** ISO timestamp of the last signal; null when SIN_SENAL. */
    last_at: string | null;
    /** Hours since the last signal; null when SIN_SENAL. */
    hours_since_last: number | null;
    /** Total signals in the 7-day lookback window. */
    total_last_7d: number;
    /** Rolling daily average over the lookback window. */
    signals_per_day: number;
    /** Signal stability percentage [0,100]; null when SIN_SENAL. */
    stability_pct: number | null;
    freshness: SignalFreshness;
  };

  gps: {
    /** Provider display name; null when 'Sin proveedor' upstream. */
    provider: string | null;
    health: GpsHealth;
  };

  score: {
    /** Overall telemetry score 0–100. */
    telemetry: number;
    /** Count of CAN metrics with `has_<metric>=true`. */
    can_metrics: number;
  };

  capabilities: TelemetryCapabilities;
}
