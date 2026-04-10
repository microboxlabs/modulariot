/**
 * DTO contract for the per-truck maintenance detail, served by
 * `/app/api/fleet/trucks/[id]/maintenance`.
 *
 * v1 is backed by the pgrest shortcut against
 * `public.fn_dx_mantenimiento_detalle` in prod-iot-gps. When the long-term
 * Java endpoint documented in `db-scripts/plans/fleet-maintenance-state.md`
 * §8.1 lands, this shape stays identical so only the server-side handler
 * swaps — no frontend diff.
 *
 * Fields intentionally omitted from v1 (additive to land later): `truck_id`,
 * `entity_id`, `status.label`, `status.description`, `source.*`,
 * `remaining.km_manufacturer`, `remaining.km_since_service`,
 * `work_order.external_id`, `work_order.since`. Frontend i18n owns the
 * criticality label/description strings — no server round trip for copy.
 */

/**
 * 7-value criticality enum mirroring `fn_dx_mantenimiento_detalle.criticidad`.
 *
 * - `AL_DIA`      — up to date
 * - `POR_VENCER`  — < 2000 km remaining
 * - `CRITICO`     — < 500 km remaining
 * - `VENCIDO`     — remaining ≤ 0 (overdue)
 * - `EN_TALLER`   — work order currently in progress
 * - `AGENDADO`    — work order scheduled but not started
 * - `SIN_INFO`    — no odometer signal upstream (~87% of the fleet in prod)
 */
export type MaintenanceCriticality =
  | "AL_DIA"
  | "POR_VENCER"
  | "CRITICO"
  | "VENCIDO"
  | "EN_TALLER"
  | "AGENDADO"
  | "SIN_INFO";

export interface TruckMaintenanceDetail {
  plate: string;
  /** Contract external id (`rent_id` / OA-xxxxx). */
  contract_external_id: string | null;

  odometer: {
    /** Current odometer in km; null means the upstream has no signal. */
    current_km: number | null;
    /** 7-day rolling average km/day; null or 0 means "not enough data". */
    km_per_day_7d: number | null;
  };

  plan: {
    /** Contractual maintenance interval in km. */
    interval_km: number;
    /** Odometer at last closed work order; null when never serviced. */
    last_service_km: number | null;
    /** ISO timestamp of the most recent closed work order; null when never serviced. */
    last_service_at: string | null;
    /** `interval_km + last_service_km`. */
    next_service_target_km: number;
    /**
     * Distinct completed work orders. Temporarily nullable: the pgrest
     * source function (`fn_dx_mantenimiento_detalle`) recently dropped
     * `num_maintance` from its output. Restore when the Java endpoint
     * ships.
     */
    completed_services: number | null;
    /** `odometer.current_km - plan.last_service_km`, null when either is missing. */
    km_since_last_service: number | null;
    /** `(km_since_last_service / interval_km) * 100`, null when `km_since_last_service` is null. */
    pct_of_interval: number | null;
  };

  remaining: {
    /** Effective remaining km — the source's `km_rest_peor`. */
    km_effective: number | null;
    /** ABS of remaining when < 0; null when not overdue. */
    km_overdue: number | null;
  };

  forecast: {
    estimated_days_remaining: number | null;
    /** ISO date (`YYYY-MM-DD`). */
    estimated_service_date: string | null;
  };

  work_order: {
    status: "EN_TALLER" | "AGENDADO" | null;
    days_in_status: number | null;
  };

  status: {
    criticality: MaintenanceCriticality;
  };
}
