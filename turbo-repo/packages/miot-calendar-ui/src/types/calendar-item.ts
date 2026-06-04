import type { ComponentType } from "react";

/** Accent color for a planned grid chip (background tint + left border). */
export type CalendarItemColor = "blue" | "purple";

/** A small colored pill shown on a calendar item (status flags, category). */
export interface CalendarItemBadge {
  label: string;
  /**
   * Visual tone. Maps to a fixed Tailwind palette (see ItemCard). Defaults to
   * "gray". Accepts the common flowbite-style names so host mappings read
   * naturally (e.g. "purple", "red"/"failure", "green"/"success", "blue"/"info",
   * "yellow"/"warning").
   */
  tone?: string;
  /** Native title tooltip. */
  tooltip?: string;
  /** Optional leading icon (host-provided to keep the package dependency-light). */
  icon?: ComponentType<{ className?: string }>;
}

/** Status drives a metric's tint (mirrors the lead-time KPI styling). */
export type CalendarItemMetricStatus = "success" | "warning" | "error" | "unknown";

/**
 * A single KPI on a calendar item. Two render modes:
 * - `max` set   → an occupancy-style mini progress bar (value as % of max).
 * - `max` unset → an icon + value (with optional `unit` suffix), tinted by `status`.
 */
export interface CalendarItemMetric {
  label: string;
  value: number | null;
  max?: number;
  status?: CalendarItemMetricStatus;
  icon?: ComponentType<{ className?: string }>;
  unit?: string;
}

/**
 * Canonical, domain-agnostic descriptor of a thing shown in the calendar
 * sidebar list (as a card) and on the grid once planned (as a chip). The host
 * maps its own domain object to this shape via `CalendarHost.toItem`; the
 * opaque `raw` field carries the original object back to host render overrides.
 */
export interface CalendarItem {
  id: string;
  title: string;
  /** Secondary line, e.g. an origin → destination route. */
  subtitle?: string;
  badges?: CalendarItemBadge[];
  metrics?: CalendarItemMetric[];
  /** Planned-chip accent; "blue" (default) or "purple" (e.g. urgent). */
  color?: CalendarItemColor;
  /** Free-form status tag for host logic; not rendered by the defaults. */
  status?: string;
  /** The host's original object, opaque to the package. */
  raw?: unknown;
}
