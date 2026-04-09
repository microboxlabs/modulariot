/**
 * DTO contract for the per-truck usage / fleet utilization detail, served
 * by `/app/api/fleet/trucks/[id]/usage`.
 *
 * v1 is backed by the pgrest shortcut against `public.fn_dx_uso_flota_detalle`
 * in prod-iot-gps. When the long-term Java endpoint lands this shape stays
 * identical so only the server-side handler swaps.
 *
 * Scope notes — the function's contract is **lifetime**, not monthly:
 * `max_travel_km` is the full allowance over the vehicle's life, and
 * `pct_consumed` / `deviation_km` are cumulative against it. Only the
 * fields under `period` use the rolling lookback window.
 */

/**
 * Contract consumption classification. SIN_DATOS means the upstream has no
 * distance signal at all (≈10% of the fleet today).
 */
export type ContractDeviation =
  | "NORMAL"
  | "SOBREUSO"
  | "SUBUTILIZADO"
  | "SIN_DATOS";

/**
 * Lifetime usage intensity bucket. SIN_DATO pairs with `SIN_DATOS` above
 * when the vehicle has no odometer coverage at all.
 */
export type UsageIntensity = "ALTA" | "MEDIA" | "BAJA" | "SIN_DATO";

export interface TruckUsageDetail {
  plate: string;

  /**
   * Use-type classification from the upstream catalog (e.g. "Mixed",
   * "Urbano"). Null when the upstream value is empty/whitespace.
   */
  use_type: string | null;

  odometer: {
    /** Current odometer (km). Null when `SIN_DATOS`. */
    current_km: number | null;
    /** Whether the device natively reports odometer. */
    has_odometer: boolean;
  };

  contract: {
    /** Contractual lifetime allowance (km). */
    max_travel_km: number;
    /** Cumulative consumption 0–100+. Null when `SIN_DATOS`. */
    pct_consumed: number | null;
    /**
     * Signed deviation in km: positive means sobreuso (over contract),
     * negative means within contract. Null when `SIN_DATOS`.
     */
    deviation_km: number | null;
    /**
     * Km remaining before hitting the contract ceiling. 0 when already
     * over; null when `SIN_DATOS`.
     */
    remaining_km: number | null;
    status: ContractDeviation;
  };

  period: {
    /** Rolling lookback window in days (matches the upstream default). */
    lookback_days: number;
    /** Km traveled in the lookback window. Null when no signal. */
    km_traveled: number | null;
    /** Average km / day across the window. Null when no signal. */
    km_per_day: number | null;
    /** Days with signal in the window (0 — `lookback_days`). */
    active_days: number;
    intensity: UsageIntensity;
  };
}
