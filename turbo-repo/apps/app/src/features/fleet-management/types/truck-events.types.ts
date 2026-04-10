/**
 * DTO contract for the per-truck operational events feed, served by
 * `/app/api/fleet/trucks/[id]/events`.
 *
 * v1 is backed by the pgrest shortcut against
 * `public.fn_dx_eventos_detalle` in prod-iot-gps. When the long-term
 * Java endpoint lands, this shape stays identical.
 */

/** Severity enum from `fn_dx_eventos_detalle.severidad`. */
export type EventSeverity = "Bajo" | "Medio" | "Alto" | "Crítico";

export interface TruckEventItem {
  id: number;
  /** ISO timestamp of the event. */
  timestamp: string;
  /** Source category: SEÑAL, VELOCIDAD, OTROS, etc. */
  category: string;
  /** English symptom name (e.g. "Lost Signal", "Speed Limit Standard"). */
  symptom_name: string;
  /** Event duration in minutes; null when instantaneous or not applicable. */
  duration_minutes: number | null;
  severity: EventSeverity;
  /** ICU severity code: 1 (Bajo) → 4 (Crítico). */
  icu_code: number;
  /** Detected speed in km/h (VELOCIDAD events only). */
  speed_detected: number | null;
  /** Speed limit in km/h (VELOCIDAD events only). */
  speed_limit: number | null;
  /** Pre-built human-readable description in Spanish from the source function. */
  message: string;
  /** Whether the event has an associated treatment/resolution. */
  has_treatment: boolean;
  /** Treatment status (e.g. "open", "closed") when has_treatment is true. */
  treatment_status: string | null;
}

export interface TruckEventsDetail {
  plate: string;
  events: TruckEventItem[];
}
