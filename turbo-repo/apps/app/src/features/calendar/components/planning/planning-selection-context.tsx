"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {
  useCalendarTimeWindows,
  useCalendarSlots,
  useCalendars,
  useMyTasks,
  createCalendarTimeWindow,
  updateCalendarTimeWindow,
  deactivateCalendarTimeWindow,
  createBooking,
  moveBooking,
  updateBooking,
  cancelBooking,
  listBookings,
  updateServiceCategory,
  advanceWorkflowTask,
  notifyCalendarBinding,
} from "@/features/common/providers/client-api.provider";
import type { BookingTaskAdvance } from "@/features/common/providers/client-api.provider";
import { parseUrlDate } from "@/features/calendar/services/calendar.service";
import type {
  BookingRequest,
  BookingResponse,
  MoveBookingRequest,
  SlotResponse,
} from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import {
  asTaskStageFromColumn,
  getNextTransition,
  getUnplanTransition,
  getUnassignTransition,
} from "@/features/calendar/services/task-stage-transitions";
import { ShowNotification } from "@/features/notifications/notification";
import {
  apiToLocalTimeWindow,
  localToApiTimeWindow,
  TimeWindowResponseSchema,
} from "@/features/calendar/services/time-window.service";
import { tr } from "@/features/i18n/tr.service";
import {
  decideUnplanBindingNotification,
  decideUnassignBindingNotification,
} from "@/features/calendar/services/task-driven-binding-gate";
import {
  decideAssignTaskAdvance,
  getTaskDrivenUnassignTransition,
} from "@/features/calendar/services/task-driven-assign";
import { decidePlanTaskAdvance } from "@/features/calendar/services/task-driven-plan";
import { useTaskDrivenOrigins } from "@/features/calendar/services/use-task-driven-origins";
import { useCalendarViewMode } from "./use-calendar-view-mode";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);

/**
 * Represents a selected time slot in the calendar
 */
export interface SelectedSlot {
  date: Date;
  hour: number;
  minutes: number;
  dayIndex?: number; // For week view
  /** The specific andén (platform) number assigned (1-based) */
  anden?: number;
}

/**
 * Time window configuration for quota management
 * Format: W1-4 1-5 0900-1700
 *
 * Types:
 * - "weekly": Applies to multiple days (default)
 * - "daily-override": Applies to a specific date, overrides weekly windows
 */
/**
 * Available color presets for time windows
 */
export const TIME_WINDOW_COLORS = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    badge:
      "bg-emerald-100 dark:bg-emerald-800/80 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    hover: "hover:bg-blue-100 dark:hover:bg-blue-900/30",
    badge: "bg-blue-100 dark:bg-blue-800/80 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    hover: "hover:bg-violet-100 dark:hover:bg-violet-900/30",
    badge:
      "bg-violet-100 dark:bg-violet-800/80 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-900/20",
    hover: "hover:bg-rose-100 dark:hover:bg-rose-900/30",
    badge: "bg-rose-100 dark:bg-rose-800/80 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    hover: "hover:bg-amber-100 dark:hover:bg-amber-900/30",
    badge:
      "bg-amber-100 dark:bg-amber-800/80 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    hover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/30",
    badge: "bg-cyan-100 dark:bg-cyan-800/80 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  lime: {
    bg: "bg-lime-50 dark:bg-lime-900/20",
    hover: "hover:bg-lime-100 dark:hover:bg-lime-900/30",
    badge: "bg-lime-100 dark:bg-lime-800/80 text-lime-700 dark:text-lime-300",
    dot: "bg-lime-500",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    hover: "hover:bg-orange-100 dark:hover:bg-orange-900/30",
    badge:
      "bg-orange-100 dark:bg-orange-800/80 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
} as const;

export type TimeWindowColor = keyof typeof TIME_WINDOW_COLORS;

/**
 * Unified time slot configuration for both quota windows and blocks
 * Stored in a single database table
 *
 * @property kind - Discriminant: "window" (has quota) or "block" (prevents scheduling)
 * @property type - Pattern type: "weekly" (recurring) or "daily-override" (specific date)
 * @property quota - Capacity limit (only used when kind="window", ignored for blocks)
 * @property color - Visual color theme (optional, mainly for windows)
 *
 * Pattern formats:
 * - weekly: Uses weeklyPattern string "W1-4 1-5 0900-1700"
 *   - W1-4: Weeks 1-4 of month (W* for all weeks)
 *   - 1-5: Days Monday(1) to Friday(5)
 *   - 0900-1700: Time range HHMM
 * - daily-override: Uses ISO timestamps for specific date/time ranges
 */
export interface TimeSlot {
  id: string;
  name: string;
  kind: "window" | "block";
  type: "weekly" | "daily-override";
  // For weekly type: pattern string like "W1-4 1-5 0900-1700"
  weeklyPattern?: string;
  // For daily-override type: ISO timestamps
  startTimestamp?: string; // ISO 8601 format: "2026-01-20T09:00:00"
  endTimestamp?: string; // ISO 8601 format: "2026-01-20T17:00:00"
  // Quota (used when kind="window", can be 0 or omitted for blocks)
  quota?: number;
  // Visual color (optional, mainly for windows)
  color?: TimeWindowColor;
  // Server-managed shift cadence in minutes; only present on TWs loaded from
  // the API. Falls back to the row granularity (30 min) when missing.
  slotDurationMinutes?: number;
  // How slot duration is determined: "auto" (derived from quota/parallelism) or
  // "manual" (admin-set slotDurationMinutes). Ignored for blocks. Treated as "auto"
  // when absent (older TWs / pre-v0.5.0 backend).
  slotGenerationMode?: "auto" | "manual";
  // Derived counts from the API (when present): total slots the window generates
  // (`totalSlots`) and how many can hold bookings (`bookableSlots` — now always equal
  // to `totalSlots`; the window's `quota` caps the day's total bookings separately).
  // Recompute locally when absent.
  totalSlots?: number;
  bookableSlots?: number;
}

/**
 * Type alias for backward compatibility - TimeWindow is a TimeSlot with kind="window"
 */
export type TimeWindow = TimeSlot & { kind: "window"; quota: number };

/**
 * Type alias for backward compatibility - TimeBlock is a TimeSlot with kind="block"
 */
export type TimeBlock = TimeSlot & { kind: "block" };

/**
 * Type guard: checks if a TimeSlot is a window (has quota for scheduling limits)
 */
export function isTimeWindow(slot: TimeSlot): slot is TimeWindow {
  return slot.kind === "window";
}

/**
 * Type guard: checks if a TimeSlot is a block (prevents any scheduling)
 */
export function isTimeBlock(slot: TimeSlot): slot is TimeBlock {
  return slot.kind === "block";
}

/**
 * Parsed weekly pattern for internal use
 */
export interface ParsedWeeklyPattern {
  weeks: number[]; // 1-5 for weeks of month, empty = all weeks
  days: number[]; // 1 = Monday, ..., 7 = Sunday
  startHour: number;
  startMinutes: number;
  endHour: number;
  endMinutes: number;
}

/**
 * Utility functions for TimeWindow operations
 */
export const TimeWindowUtils = {
  /**
   * Parse a weekly pattern string into its components
   * Format: "W1-4 1-5 0900-1700" or "W* 1-5 0900-1700"
   */
  parseWeeklyPattern(pattern: string): ParsedWeeklyPattern | null {
    if (!pattern) return null;
    const match = /^W(\*|[\d,-]+)\s+([\d,-]+)\s+(\d{4})-(\d{4})$/.exec(pattern);
    if (!match) return null;

    const [, weeksStr, daysStr, startTime, endTime] = match;

    // Parse weeks
    let weeks: number[] = [];
    if (weeksStr !== "*") {
      weeks = this.parseRangeString(weeksStr);
    }

    // Parse days
    const days = this.parseRangeString(daysStr);

    // Parse times
    const startHour = Number.parseInt(startTime.slice(0, 2), 10);
    const startMinutes = Number.parseInt(startTime.slice(2, 4), 10);
    const endHour = Number.parseInt(endTime.slice(0, 2), 10);
    const endMinutes = Number.parseInt(endTime.slice(2, 4), 10);

    return { weeks, days, startHour, startMinutes, endHour, endMinutes };
  },

  /**
   * Parse a range string like "1-5" or "1,3,5" into an array of numbers
   */
  parseRangeString(str: string): number[] {
    const result: number[] = [];
    const parts = str.split(",");
    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
      } else {
        result.push(Number(part));
      }
    }
    return result;
  },

  /**
   * Build a weekly pattern string from components
   * Returns empty string if days is empty (invalid pattern)
   */
  buildWeeklyPattern(
    weeks: number[],
    days: number[],
    startHour: number,
    startMinutes: number,
    endHour: number,
    endMinutes: number
  ): string {
    if (days.length === 0) return ""; // Can't have a pattern without days
    const weeksStr = this.formatRangeString(weeks, "W");
    const daysStr = this.formatRangeString(days);
    const startTime = `${startHour.toString().padStart(2, "0")}${startMinutes.toString().padStart(2, "0")}`;
    const endTime = `${endHour.toString().padStart(2, "0")}${endMinutes.toString().padStart(2, "0")}`;
    return `${weeksStr} ${daysStr} ${startTime}-${endTime}`;
  },

  /**
   * Format an array of numbers into a range string
   * e.g., [1,2,3,4,5] -> "1-5", [1,3,5] -> "1,3,5"
   * For weeks with prefix: [] -> "W*", [1,2] -> "W1-2"
   * For days without prefix: [] -> "", [1,2,3] -> "1-3"
   */
  formatRangeString(nums: number[], prefix = ""): string {
    if (nums.length === 0) {
      // For weeks (with prefix), empty means "all weeks" = W*
      // For days (no prefix), empty means nothing selected
      return prefix ? `${prefix}*` : "";
    }
    const sorted = [...nums].sort((a, b) => a - b);

    // Check if it's a continuous range
    const isRange =
      sorted.length > 1 &&
      sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);

    if (isRange) {
      return `${prefix}${sorted[0]}-${sorted.at(-1)}`;
    }
    return `${prefix}${sorted.join(",")}`;
  },

  /**
   * Check if a time window or block matches a specific slot
   */
  matchesSlot(
    window: TimeSlot,
    date: dayjs.Dayjs,
    hour: number,
    minutes: number
  ): boolean {
    if (window.type === "daily-override") {
      return this.matchesDailyOverride(window, date, hour, minutes);
    }
    return this.matchesWeeklyPattern(window, date, hour, minutes);
  },

  /**
   * Check if a daily-override window matches a slot
   */
  matchesDailyOverride(
    window: TimeSlot,
    date: dayjs.Dayjs,
    hour: number,
    minutes: number
  ): boolean {
    if (!window.startTimestamp || !window.endTimestamp) return false;

    const start = dayjs(window.startTimestamp);
    const end = dayjs(window.endTimestamp);
    const slotTime = date.hour(hour).minute(minutes).second(0);

    return (
      slotTime.isSame(start, "day") &&
      slotTime.isSameOrAfter(start) &&
      slotTime.isBefore(end)
    );
  },

  /**
   * Check if a weekly pattern window matches a slot
   */
  matchesWeeklyPattern(
    window: TimeSlot,
    date: dayjs.Dayjs,
    hour: number,
    minutes: number
  ): boolean {
    if (!window.weeklyPattern) return false;

    const parsed = this.parseWeeklyPattern(window.weeklyPattern);
    if (!parsed) return false;

    // Convert JS day (0=Sunday) to format day (1=Monday, 7=Sunday)
    const jsDay = date.day();
    const formatDay = jsDay === 0 ? 7 : jsDay;

    // Check day
    if (!parsed.days.includes(formatDay)) return false;

    // Check week of month
    if (parsed.weeks.length > 0) {
      const weekOfMonth = getWeekOfMonth(date);
      if (!parsed.weeks.includes(weekOfMonth)) return false;
    }

    // Check time
    const slotMinutes = hour * 60 + minutes;
    const windowStart = parsed.startHour * 60 + parsed.startMinutes;
    const windowEnd = parsed.endHour * 60 + parsed.endMinutes;

    return slotMinutes >= windowStart && slotMinutes < windowEnd;
  },

  /**
   * Get time range from a window or block (works for both types)
   */
  getTimeRange(window: TimeSlot): {
    startHour: number;
    startMinutes: number;
    endHour: number;
    endMinutes: number;
  } | null {
    if (window.type === "daily-override") {
      if (!window.startTimestamp || !window.endTimestamp) return null;
      const start = dayjs(window.startTimestamp);
      const end = dayjs(window.endTimestamp);
      return {
        startHour: start.hour(),
        startMinutes: start.minute(),
        endHour: end.hour(),
        endMinutes: end.minute(),
      };
    }

    if (!window.weeklyPattern) return null;
    const parsed = this.parseWeeklyPattern(window.weeklyPattern);
    if (!parsed) return null;
    return {
      startHour: parsed.startHour,
      startMinutes: parsed.startMinutes,
      endHour: parsed.endHour,
      endMinutes: parsed.endMinutes,
    };
  },

  /**
   * Get the date for a daily-override window or block
   */
  getDate(window: TimeSlot): string | null {
    if (window.type !== "daily-override" || !window.startTimestamp) return null;
    return dayjs(window.startTimestamp).format("YYYY-MM-DD");
  },

  /**
   * Check if a daily-override window or block is expired (before today)
   */
  isExpired(window: TimeSlot): boolean {
    if (window.type !== "daily-override" || !window.startTimestamp)
      return false;
    return dayjs(window.startTimestamp).isBefore(dayjs().startOf("day"), "day");
  },

  /**
   * Create a display string for a time window
   */
  formatDisplay(window: TimeWindow): string {
    if (window.type === "daily-override") {
      if (!window.startTimestamp || !window.endTimestamp) return "";
      const start = dayjs(window.startTimestamp);
      const end = dayjs(window.endTimestamp);
      return `${start.format("DD/MM/YYYY")} ${start.format("HHmm")}-${end.format("HHmm")}`;
    }
    return window.weeklyPattern ?? "";
  },
};

// Re-export from common components for backward compatibility
export {
  type LeadTimeData,
  getLeadTimeStatus,
} from "@/features/common/components/kpi-display";

import type { LeadTimeData } from "@/features/common/components/kpi-display";

/**
 * Trip type options
 */
export type TripType = "Sider" | "Doble Sider" | "Rampla";

/**
 * Debug flag - set to true to show test services in the calendar
 */
export const DEBUG_SHOW_TEST_SERVICE = false;

/**
 * Test services data for development/debugging
 */
export const TEST_SERVICES: SelectedService[] = [
  {
    id: "TEST-001",
    cliente: "Cliente de Prueba",
    origen: "STG",
    lugarCarguio: "Bodega Central",
    destino: "VAP",
    tipoViaje: "Sider",
    ocupacion: 75,
    permanencia: "2 días",
    leadTime: {
      total_lineasoc_cumplen: 3,
      total_lineasoc_incumplen: 1,
      lineasoc_pctn_cumplimiento: 100,
    },
    eta: "2026-01-25T14:30:00",
    incidencias: ["urgencia"],
    observaciones: "Servicio de prueba para desarrollo",
    prioridad: 1,
  },
  {
    id: "TEST-002",
    cliente: "Acme Corp",
    origen: "VAP",
    lugarCarguio: "Puerto Valparaíso",
    destino: "STG",
    tipoViaje: "Doble Sider",
    ocupacion: 50,
    permanencia: "1 día",
    leadTime: {
      total_lineasoc_cumplen: 2,
      total_lineasoc_incumplen: 2,
      lineasoc_pctn_cumplimiento: 50,
    },
    eta: "2026-01-26T09:00:00",
    incidencias: [],
    observaciones: "Carga frágil - manejar con cuidado",
    prioridad: 2,
  },
  {
    id: "TEST-003",
    cliente: "Logística Express",
    origen: "ANT",
    lugarCarguio: "Centro de Distribución Norte",
    destino: "STG",
    tipoViaje: "Rampla",
    ocupacion: 90,
    permanencia: "3 días",
    leadTime: {
      total_lineasoc_cumplen: 0,
      total_lineasoc_incumplen: 4,
      lineasoc_pctn_cumplimiento: 0,
    },
    eta: "2026-01-27T16:00:00",
    incidencias: ["shutdown", "c5"],
    observaciones: "Requiere documentación especial",
    prioridad: 3,
  },
  {
    id: "TEST-004",
    cliente: "Transportes del Sur",
    origen: "CON",
    lugarCarguio: "Terminal Concepción",
    destino: "VAP",
    tipoViaje: "Sider",
    ocupacion: 25,
    permanencia: "1 día",
    leadTime: {
      total_lineasoc_cumplen: 5,
      total_lineasoc_incumplen: 0,
      lineasoc_pctn_cumplimiento: 100,
    },
    eta: "2026-01-28T11:30:00",
    incidencias: [],
    observaciones: "",
    prioridad: 4,
  },
  {
    id: "TEST-005",
    cliente: "Global Shipping",
    origen: "STG",
    lugarCarguio: "Bodega Sur",
    destino: "ANT",
    tipoViaje: "Doble Sider",
    ocupacion: 100,
    permanencia: "4 días",
    leadTime: {
      total_lineasoc_cumplen: 1,
      total_lineasoc_incumplen: 3,
      lineasoc_pctn_cumplimiento: 25,
    },
    eta: "2026-01-25T08:00:00",
    incidencias: ["urgencia"],
    observaciones: "Cliente VIP - prioridad alta",
    prioridad: 1,
  },
];

/**
 * @deprecated Use TEST_SERVICES array instead
 */
export const TEST_SERVICE: SelectedService = TEST_SERVICES[0];

/**
 * Represents a service that can be selected in the planning calendar
 * Based on the Service mock data contract
 */
export interface SelectedService {
  id: string;
  /**
   * Stable business id for the service (e.g. "1626876"). Mirrors
   * `mintral_serviceCode` from Alfresco; the only key that survives every
   * workflow stage advance, so use it — never `taskId` or `id` — when
   * resolving the live workflow task for a planned service.
   */
  mintral_serviceCode?: string;
  cliente: string;
  mintral_clientRut?: string;
  mintral_delegacionOrigen?: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
  /**
   * Raw Alfresco `mintral_serviceKind` value (e.g. "Sider", "Doble Sider").
   * Unlike `tipoViaje` — a lossy display projection — this is forwarded
   * verbatim on the booking payload so the bookings route can populate the
   * coordinator binding's `tipo_servicio` and reach the assigned stage.
   */
  mintral_serviceKind?: string;
  ocupacion: number; // percentage 0-100
  permanencia: string;
  leadTime: LeadTimeData;
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  mintral_incidents?: Array<[string, string]>; // e.g. [["mintral_incident_C306", "SOBREDIMENSION"], ["mintral_incident_C307", "SHUTDOWN"]]
  observaciones: string;
  prioridad: number;
  cm_created?: string; // ISO datetime - creation date
  loadConstraint?: string; // Dominant constraint: "Carga" | "Pallets" | "Volumen"
  loadMaxUtilization?: number; // Maximum of the three utilizations %
  loadWeightUtilization?: number; // Weight capacity utilization %
  loadPalletUtilization?: number; // Pallet position utilization %
  loadVolumeUtilization?: number; // Volumetric utilization %
  serviceCategory?: string; // Alfresco mintral_serviceCategory code
  expectedDepartureDate?: string; // ISO datetime - expected departure date
  presentationDate?: string; // ISO datetime - service creation/presentation date
  /** Primary driver assigned to this service (frontend-only for now) */
  assignedDriver?: string;
  /** Secondary driver assigned to this service (frontend-only for now) */
  assignedDriver2?: string;
  /**
   * Accredited-resources `carrier_id` chosen in the Asignación tab. Persisted
   * on the booking payload so reopening the sidebar for a planned service
   * hydrates the dropdowns with the previously confirmed selection.
   */
  assignedCarrier?: string;
  /** Accredited-resources TRUCK `resource_id` assigned in the Asignación tab. */
  assignedTruck?: string;
  /** Assigned trailer id — placeholder until the trailer feed is wired. */
  assignedTrailer?: string;
  /**
   * Carrier's upstream `prve_codigo` (from
   * `AccreditedResource.external_id`). Persisted on the booking so the
   * calendar-binding extractor can ship it as `carrier_external_id` —
   * Alerce `proveedor` is sourced from this code, not from a UUID→RUT
   * resolver hop nor from a service-sync Activiti variable.
   */
  assignedCarrierExternalId?: string | null;
  /**
   * Driver / truck / trailer upstream codes (`cond_codigo`,
   * `cami_matricula`, `remo_matricula`). Declared for schema symmetry with
   * the carrier slot; not yet routed downstream — driver depends on an
   * Alerce-contract clarification, truck/trailer codes equal the resolver's
   * plate today so the switch is a future no-op cleanup.
   */
  assignedDriverExternalId?: string | null;
  assignedDriver2ExternalId?: string | null;
  assignedTruckExternalId?: string | null;
  assignedTrailerExternalId?: string | null;
}

export type TaskStage =
  | "planService"
  | "assignDriver"
  | "presentDriver"
  | "prepareService"
  | "missionControl";

/**
 * A service that has been confirmed and placed in a slot
 */
export interface PlannedService {
  service: SelectedService;
  slot: SelectedSlot;
}

/**
 * Tracks a service being reassigned with its original slot for restoration
 */
export interface ReassigningService {
  service: PlannedService;
  originalSlot: SelectedSlot;
}

/**
 * Tracks when we're in assignment-only mode (opened from context menu "Asignar")
 * In this mode, only the Asignación tab should be available
 */
export interface AssigningService {
  service: PlannedService;
}

async function cancelBookingWithWarning(
  bookingId: string,
  message: string
): Promise<void> {
  await cancelBooking(bookingId).catch((err) => console.warn(message, err));
}

async function syncServiceCategoryWithWorkflow(
  service: SelectedService,
  bookingId: string,
  liveTaskId: string | undefined
): Promise<void> {
  if (!service.serviceCategory) {
    return;
  }

  if (!liveTaskId) {
    // The kanban index didn't surface a live task for this service — most
    // commonly because the workflow has advanced past the planner-tracked
    // stages while the user was on the page (or never was at one). The
    // local binding state already captured the (carrier, driver, truck)
    // tuple via the bookings POST → coordinator binding webscript, so
    // rolling back the booking here would drift state for no upside.
    // Log + skip; a future user action on the service will retry the
    // category sync once a live task is in scope.
    console.warn(
      "Service category sync skipped — no live Alfresco task for service",
      service.mintral_serviceCode,
      "(category:",
      service.serviceCategory,
      ", booking:",
      bookingId,
      ")"
    );
    return;
  }

  try {
    await updateServiceCategory(liveTaskId, service.serviceCategory);
  } catch (err) {
    await cancelBookingWithWarning(
      bookingId,
      "Failed to cancel booking after service category update error:"
    );
    throw err;
  }
}

interface PersistPlannedBookingParams {
  calendarId?: string;
  service: SelectedService;
  slot: SelectedSlot;
  oldBookingId?: string;
  originalPlannedService: PlannedService | null;
  /**
   * Live Alfresco task id for the service at the moment the user confirmed,
   * resolved from the kanban — never the booking — so it always points at
   * the task currently representing this service. Undefined when the
   * service has no active workflow task (rare; means the workflow finished
   * before the user clicked Confirm).
   */
  liveTaskId: string | undefined;
  /**
   * When set, the workflow task is advanced after the booking is written
   * (and after the service-category sync, when applicable).
   */
  taskAdvance?: BookingTaskAdvance;
  setBookingIds: Dispatch<SetStateAction<Map<string, string>>>;
  setBookingVersion: Dispatch<SetStateAction<number>>;
  setPlannedServices: Dispatch<SetStateAction<PlannedService[]>>;
  refreshSlots: () => void;
}

function buildResource(service: SelectedService, slot: SelectedSlot) {
  return {
    id: service.id,
    type: "service",
    label: service.cliente,
    data: {
      ...service,
      ...(slot.anden === undefined ? {} : { _anden: slot.anden }),
    },
  };
}

function buildBookingRequest(
  calendarId: string,
  service: SelectedService,
  slot: SelectedSlot
): BookingRequest {
  return {
    calendarId,
    resource: buildResource(service, slot),
    slot: {
      date: dayjs(slot.date).format("YYYY-MM-DD"),
      hour: slot.hour,
      minutes: slot.minutes,
    },
  };
}

// Move payload for an existing booking — slot + a fresh resource snapshot so
// any planner-side overrides (serviceCategory, assignment tuple, _anden, …)
// land in `cld_bookings.resource_data` as part of the same write.
function buildMoveRequest(
  service: SelectedService,
  slot: SelectedSlot
): MoveBookingRequest {
  return {
    slot: {
      date: dayjs(slot.date).format("YYYY-MM-DD"),
      hour: slot.hour,
      minutes: slot.minutes,
    },
    resource: buildResource(service, slot),
  };
}

function rollbackPlannedService(
  setPlannedServices: Dispatch<SetStateAction<PlannedService[]>>,
  serviceId: string,
  originalPlannedService: PlannedService | null
): void {
  setPlannedServices((prev) => {
    const withoutNew = prev.filter((p) => p.service.id !== serviceId);
    return originalPlannedService
      ? [...withoutNew, originalPlannedService]
      : withoutNew;
  });
}

/**
 * Task-driven PLAN move: ECM #266's `OnCreateAssignDriverBinding` writes
 * the `cld_bookings` row itself from the slot processVariables on the
 * `assignDriver` create. The FE must NOT call `POST /app/api/calendar/bookings`
 * in this path. Signaled by a `PlanProcessVariables` shape on
 * `taskAdvance.processVariables` (presence of `calendar_id` key), AND no
 * `oldBookingId` (a re-plan with an existing row still routes through the
 * atomic `bookings/{id}/move` so the row id and slot stay in lockstep —
 * ECM's adoption guard adopts that same row on the next assignDriver
 * create).
 */
function isTaskDrivenPlanCreate(
  oldBookingId: string | undefined,
  taskAdvance: BookingTaskAdvance | undefined
): boolean {
  if (oldBookingId) return false;
  const vars = taskAdvance?.processVariables;
  return !!vars && "calendar_id" in vars;
}

async function persistPlannedBooking({
  calendarId,
  service,
  slot,
  oldBookingId,
  originalPlannedService,
  liveTaskId,
  taskAdvance,
  setBookingIds,
  setBookingVersion,
  setPlannedServices,
  refreshSlots,
}: PersistPlannedBookingParams): Promise<void> {
  if (!calendarId) {
    return;
  }

  try {
    if (isTaskDrivenPlanCreate(oldBookingId, taskAdvance) && taskAdvance) {
      // ECM owns the booking row for task-driven plan. Sync the service
      // category onto the live task (best-effort; no booking to roll back
      // since none exists yet) and let ECM's `OnCreateAssignDriverBinding`
      // create the row from the slot processVariables on the next
      // `assignDriver` create.
      if (liveTaskId && service.serviceCategory) {
        try {
          await updateServiceCategory(liveTaskId, service.serviceCategory);
        } catch (err) {
          console.warn(
            "Failed to sync service category before task-driven plan move:",
            err
          );
          throw err;
        }
      }
      await advanceWorkflowTask(
        taskAdvance.taskId,
        taskAdvance.transitionId,
        taskAdvance.processVariables
      );
      refreshSlots();
      setBookingVersion((v) => v + 1);
      return;
    }

    // Existing booking → atomic in-place move via POST /bookings/{id}/move.
    // The booking id is preserved; a same-slot call collapses to a
    // payload-only update on the server. This subsumes both the planner's
    // "Reasignar" flow (different slot) and the "Asignar" flow on an
    // already-planned service (same slot, refreshed assignment tuple).
    //
    // No follow-up cancel is needed — the row is re-pointed in place, not
    // create-then-delete. The bookingIds map keeps the same id.
    const booking: BookingResponse = oldBookingId
      ? await moveBooking(oldBookingId, buildMoveRequest(service, slot))
      : await createBooking(buildBookingRequest(calendarId, service, slot));

    await syncServiceCategoryWithWorkflow(service, booking.id, liveTaskId);
    if (taskAdvance) {
      await advanceWorkflowTask(
        taskAdvance.taskId,
        taskAdvance.transitionId,
        taskAdvance.processVariables
      );
    }

    setBookingIds((prev) => {
      const next = new Map(prev);
      next.set(service.id, booking.id);
      return next;
    });

    refreshSlots();
    setBookingVersion((v) => v + 1);
  } catch (err) {
    console.warn("Failed to persist booking:", err);
    rollbackPlannedService(
      setPlannedServices,
      service.id,
      originalPlannedService
    );
    throw err;
  }
}

interface PlanningSelectionContextType {
  calendarId?: string;
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  plannedServices: PlannedService[];
  /** Unified array of all time slots (windows and blocks) */
  timeSlots: TimeSlot[];
  /** Derived: only TimeWindow slots (filtered from timeSlots) */
  timeWindows: TimeWindow[];
  /** Derived: only TimeBlock slots (filtered from timeSlots) */
  timeBlocks: TimeBlock[];
  /** Number of andenes (platforms) available for simultaneous service */
  andenesCount: number;
  reassigningService: ReassigningService | null;
  /** When set, only the Asignación tab should be available (user clicked "Asignar" in context menu) */
  assigningService: AssigningService | null;
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  /** Confirm service assignment. Pass finalSlot to override the selected slot with specific time/andén.
   * Pass serviceOverrides to merge additional fields into the selected service before confirming. */
  confirmService: (
    finalSlot?: SelectedSlot,
    serviceOverrides?: Partial<SelectedService>
  ) => Promise<boolean>;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
  /** Set the unified time slots array (replaces both windows and blocks) */
  setTimeSlots: (slots: TimeSlot[]) => Promise<void>;
  /** Convenience: set only TimeWindow slots (merges with existing blocks) - local state only */
  setTimeWindows: (windows: TimeWindow[]) => void;
  /** Convenience: set only TimeBlock slots (merges with existing windows) - local state only */
  setTimeBlocks: (blocks: TimeBlock[]) => void;
  /** Set the number of andenes available */
  setAndenesCount: (count: number) => void;
  /** Sync current time slots to API (call when user clicks "Aplicar") */
  syncTimeSlotsToAPI: () => Promise<void>;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (timeWindow: TimeWindow, date: Date) => number;
  isSlotBlocked: (date: Date, hour: number, minutes: number) => boolean;
  getBlocksForSlot: (date: Date, hour: number, minutes: number) => TimeBlock[];
  /** Get which andenes are occupied for a specific time slot */
  getOccupiedAndenes: (date: Date, hour: number, minutes: number) => number[];
  /** Get available (unoccupied) andenes for a specific time slot */
  getAvailableAndenes: (date: Date, hour: number, minutes: number) => number[];
  isSidebarOpen: boolean;
  removeService: (serviceId: string) => Promise<void>;
  /**
   * Clear the driver/transport assignment from a planned service: reverse
   * the workflow task back to `planService`, drop the assignment tuple from
   * the booking's `resource_data`, notify the coordinator (stage
   * "unassigned") and clear the local assignment fields.
   */
  removeAssignment: (serviceId: string) => Promise<void>;
  startReassignment: (plannedService: PlannedService) => void;
  cancelReassignment: () => void;
  /** Start assignment-only mode - opens sidebar with only Asignación tab available */
  startAssignment: (plannedService: PlannedService) => void;
  /** Cancel assignment-only mode */
  cancelAssignment: () => void;
  /**
   * Left-click on a chip: select only the chip's underlying slot, clearing
   * any previously selected service. The sidebar opens in "add to slot" mode
   * — identical to clicking the empty area of that slot. The existing
   * planned service is left untouched and is *not* preselected; use the
   * right-click context menu (selectChipResource) to interact with it.
   */
  selectChipSlot: (plannedService: PlannedService) => void;
  /**
   * Right-click on a chip: highlight the chip itself without touching slot
   * or service selection — the sidebar is NOT opened. Pairs with the chip
   * context menu, which opens immediately after.
   */
  selectChipResource: (plannedService: PlannedService) => void;
  /**
   * Open the sidebar populated with an existing chip's planning + assignment
   * data for inspection. Used by the calendar viewer role (no plan/assign
   * permissions): right-clicking a chip both pops the context menu and
   * pre-fills the sidebar via this call, so the sidebar's read-only render
   * has values to show. Clears reassign/assign mode and highlights the chip.
   */
  inspectPlannedService: (plannedService: PlannedService) => void;
  /** True when the given service id is the chip currently highlighted via right-click. */
  isChipSelected: (serviceId: string) => boolean;
  /** Drop the chip highlight without touching slot/service selection. */
  clearChipSelection: () => void;
  /**
   * Patch the assignment tuple (carrier/drivers/truck/trailer) on a planned
   * service. Any omitted field is left untouched; passing `undefined`
   * explicitly clears that slot. Client-side only — persistence travels on
   * the next `confirmService` call via `StoredServiceSchema`.
   */
  updateServiceAssignment: (
    serviceId: string,
    patch: Partial<
      Pick<
        SelectedService,
        | "assignedCarrier"
        | "assignedDriver"
        | "assignedDriver2"
        | "assignedTruck"
        | "assignedTrailer"
        | "assignedCarrierExternalId"
        | "assignedDriverExternalId"
        | "assignedDriver2ExternalId"
        | "assignedTruckExternalId"
        | "assignedTrailerExternalId"
      >
    >
  ) => void;
  /** Non-null when the initial bookings fetch failed; null while loading or after a successful load */
  bookingsLoadError: string | null;
  /** Backend slot data for the selected date */
  backendSlots: SlotResponse[];
  /** Whether backend slots are currently loading */
  isSlotsLoading: boolean;
  /** Refresh backend slots (e.g. after booking) */
  refreshSlots: () => void;
  /** Counter that increments after each booking change — use to trigger service list refresh */
  bookingVersion: number;
  /**
   * Resolve the *live* Alfresco task representing a service. Looks up by
   * `mintral_serviceCode` against the kanban index — never trust a stored
   * taskId, which goes stale the instant the workflow advances. Returns
   * undefined when no active task exists for the service (e.g. the
   * workflow finished).
   */
  getLiveTask: (
    serviceCode: string | undefined
  ) => { taskId: string; stage: TaskStage } | undefined;
}

const MAX_SERVICES_PER_SLOT = 99;

/**
 * Zod schema for data stored inside booking.resource.data.
 * All SelectedService fields are optional (defaults are applied on merge).
 * _anden is stored here because SlotData has no anden field.
 */
const StoredServiceSchema = z
  .object({
    mintral_clientRut: z.string().optional(),
    mintral_delegacionOrigen: z.string().optional(),
    /**
     * Stable business id for the service. Persisted because `resource.id`
     * is a derived display label (`${code}-${type}`) whose format is owed
     * to the kanban transform — keeping the raw code lets the live task
     * lookup work without parsing strings.
     */
    mintral_serviceCode: z.string().optional(),
    origen: z.string().optional(),
    lugarCarguio: z.string().optional(),
    destino: z.string().optional(),
    tipoViaje: z.enum(["Sider", "Doble Sider", "Rampla"]).optional(),
    mintral_serviceKind: z.string().optional(),
    ocupacion: z.number().optional(),
    permanencia: z.string().optional(),
    leadTime: z
      .object({
        total_lineasoc_cumplen: z.number(),
        total_lineasoc_incumplen: z.number(),
        // null means "not measured yet" — distinct from a measured 0%.
        lineasoc_pctn_cumplimiento: z.number().nullable(),
      })
      .optional(),
    eta: z.string().optional(),
    incidencias: z.array(z.string()).optional(),
    mintral_incidents: z.array(z.tuple([z.string(), z.string()])).optional(),
    observaciones: z.string().optional(),
    prioridad: z.number().optional(),
    cm_created: z.string().optional(),
    loadConstraint: z.string().optional(),
    loadMaxUtilization: z.number().optional(),
    loadWeightUtilization: z.number().optional(),
    loadPalletUtilization: z.number().optional(),
    loadVolumeUtilization: z.number().optional(),
    serviceCategory: z.string().optional(),
    expectedDepartureDate: z.string().optional(),
    presentationDate: z.string().optional(),
    assignedDriver: z.string().optional(),
    assignedDriver2: z.string().optional(),
    assignedCarrier: z.string().optional(),
    assignedTruck: z.string().optional(),
    assignedTrailer: z.string().optional(),
    assignedCarrierExternalId: z.string().nullable().optional(),
    assignedDriverExternalId: z.string().nullable().optional(),
    assignedDriver2ExternalId: z.string().nullable().optional(),
    assignedTruckExternalId: z.string().nullable().optional(),
    assignedTrailerExternalId: z.string().nullable().optional(),
    _anden: z.number().optional(),
  })
  .optional();

const PlanningSelectionContext =
  createContext<PlanningSelectionContextType | null>(null);

interface PlanningSelectionProviderProps {
  readonly children: ReactNode;
  readonly calendarId?: string;
  readonly dict: I18nDictionary;
}

/**
 * Gets the week number of the month (1-5) for a given date.
 * Exported so other modules (e.g. the shift-overlay layout helper) use the
 * exact same definition the weekly-pattern matcher does — otherwise the
 * planner and the overlay would disagree on which dates a `W1`/`W2…` TW
 * covers.
 */
export function getWeekOfMonth(date: dayjs.Dayjs): number {
  const firstDayOfMonth = date.startOf("month");
  const firstMonday =
    firstDayOfMonth.isoWeekday() <= 1
      ? firstDayOfMonth
      : firstDayOfMonth.add(8 - firstDayOfMonth.isoWeekday(), "day");

  if (date.isBefore(firstMonday)) {
    return 1;
  }

  const weekNumber = Math.ceil(
    (date.date() + firstDayOfMonth.isoWeekday() - 1) / 7
  );
  return Math.min(weekNumber, 5);
}

export function PlanningSelectionProvider({
  children,
  calendarId,
  dict,
}: PlanningSelectionProviderProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  // Visual-only "this chip is selected" mark set by right-clicking a chip.
  // Deliberately separate from `selectedService` because right-click must
  // not open the sidebar — only `selectedSlot`/`selectedService` toggle
  // `isSidebarOpen`. Slot left-click and any sidebar close clears this.
  const [selectedChipServiceId, setSelectedChipServiceId] = useState<
    string | null
  >(null);
  const [plannedServices, setPlannedServices] = useState<PlannedService[]>([]);
  // Unified state: single array for all time slots
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  // Number of andenes (platforms) available
  const [andenesCount, setAndenesCount] = useState<number>(1);
  const [reassigningService, setReassigningService] =
    useState<ReassigningService | null>(null);
  const [assigningService, setAssigningService] =
    useState<AssigningService | null>(null);
  const [bookingIds, setBookingIds] = useState<Map<string, string>>(new Map()); // Map of service.id -> booking.id from calendar backend
  const [bookingsLoadError, setBookingsLoadError] = useState<string | null>(
    null
  );
  const [bookingVersion, setBookingVersion] = useState(0);

  // Last line of defense against viewer-role UI bypass. Every booking
  // mutation (create / move / cancel) must come from a user with at least
  // one of the two mutating groups — checked again at the persist boundary
  // inside `confirmService` and `removeService`. UI gating is the primary
  // control; this guard catches stale handlers and future contributors
  // wiring a button without the matching permission check. The `?as=viewer`
  // override also collapses canPlan/canAssign to false, so a planner
  // previewing viewer mode is treated as a viewer here too.
  const { canPlan, canAssign, isLoadingPermissions } = useCalendarViewMode();
  const canMutateBookings = !isLoadingPermissions && (canPlan || canAssign);

  // Per-origin task-driven rollout set, sourced from the backend's
  // RuntimeConfigProvider (`TASK_DRIVEN_ORIGINS`). Empty until the runtime
  // config has loaded; flag-off is the legacy path so the few-ms gap is
  // safe. See `task-driven-origin.ts` for the matching contract.
  const taskDrivenOrigins = useTaskDrivenOrigins();

  // Load calendar parallelism from the backend
  const { calendars } = useCalendars();
  const initializedParallelismRef = useRef(false);

  useEffect(() => {
    if (initializedParallelismRef.current || !calendarId) return;
    const calendar = calendars.find((c) => c.id === calendarId);
    if (calendar?.parallelism) {
      setAndenesCount(calendar.parallelism);
      initializedParallelismRef.current = true;
    }
  }, [calendars, calendarId]);

  // Load time windows from the miot-calendar-client backend
  const {
    timeWindows: apiTimeWindows,
    error: timeSlotsError,
    refresh: refreshTimeWindows,
  } = useCalendarTimeWindows(calendarId ?? null);

  // Derive the selected date string for slots fetching
  const selectedDateStr = useMemo(() => {
    if (!selectedSlot) return null;
    return dayjs(selectedSlot.date).format("YYYY-MM-DD");
  }, [selectedSlot]);

  // Load backend slots for the selected calendar + date
  const {
    slots: backendSlots,
    isLoading: isSlotsLoading,
    refresh: refreshSlots,
  } = useCalendarSlots(calendarId ?? null, selectedDateStr);

  // Live workflow index for the user's active services. Intentionally
  // *not* scoped by calendarId — the kanban API switches to
  // `getUnbookedTasks` when calendarId is present, which excludes already-
  // planned services and would make `getLiveTask` return undefined for any
  // service the user is reassigning or removing. This index is keyed by
  // `mintral_serviceCode` (unique across calendars), so the wider fetch is
  // safe. Booking never persists `taskId` because Alfresco mints a new
  // task per workflow stage; this is the single source of truth for "which
  // Alfresco task represents service X right now".
  const { data: liveTasksData, refresh: refreshLiveTasks } = useMyTasks(
    ["planService", "assignDriver", "presentDriver", "prepareService", "missionControl"],
    false,
    1,
    500
  );

  const serviceCodeToLiveTask = useMemo<
    Map<string, { taskId: string; stage: TaskStage }>
  >(() => {
    const map = new Map<string, { taskId: string; stage: TaskStage }>();
    if (!liveTasksData?.data) return map;
    for (const [columnKey, board] of Object.entries(liveTasksData.data)) {
      const stage = asTaskStageFromColumn(columnKey);
      if (!stage) continue;
      for (const task of board.tasks) {
        const code = task.mintral_serviceCode;
        if (code) map.set(code, { taskId: task.id, stage });
      }
    }
    return map;
  }, [liveTasksData]);

  const getLiveTask = useCallback(
    (serviceCode: string | undefined) =>
      serviceCode ? serviceCodeToLiveTask.get(serviceCode) : undefined,
    [serviceCodeToLiveTask]
  );

  // Re-fetch the live workflow index whenever a booking is created or
  // removed — the workflow advance that ran alongside it likely changed
  // each affected service's stage and task id.
  useEffect(() => {
    if (bookingVersion > 0) {
      refreshLiveTasks();
    }
  }, [bookingVersion, refreshLiveTasks]);

  // Sync time windows from API to local state (only when there's no error)
  useEffect(() => {
    if (timeSlotsError) return;

    if (apiTimeWindows.length > 0) {
      setTimeSlots(
        apiTimeWindows.flatMap((tw) => {
          const result = TimeWindowResponseSchema.safeParse(tw);
          if (!result.success) {
            console.warn(
              "Skipping invalid time window response",
              tw,
              result.error.message
            );
            return [];
          }
          return [apiToLocalTimeWindow(result.data)];
        })
      );
    } else if (apiTimeWindows.length === 0 && !timeSlotsError) {
      setTimeSlots([]);
    }
  }, [apiTimeWindows, timeSlotsError]);

  // The upstream bookings endpoint returns an empty list when no date range is
  // passed, so derive a ±30-day window around the URL `date` param (the same
  // param the week/day views consume). Stays well inside the backend's 90-day
  // cap and covers any reasonable week navigation without refetching mid-view.
  const searchParams = useSearchParams();
  const bookingsRange = useMemo(() => {
    const anchor = parseUrlDate(searchParams.get("date")) ?? dayjs();
    return {
      startDate: anchor.subtract(30, "day").format("YYYY-MM-DD"),
      endDate: anchor.add(30, "day").format("YYYY-MM-DD"),
    };
  }, [searchParams]);

  // Load existing bookings from the backend when a calendar is selected.
  // An AbortController cancels the in-flight request when calendarId changes
  // or the component unmounts, preventing stale responses from overwriting state.
  useEffect(() => {
    if (!calendarId) return;

    const controller = new AbortController();

    listBookings(
      {
        calendarId,
        startDate: bookingsRange.startDate,
        endDate: bookingsRange.endDate,
      },
      controller.signal
    )
      .then((result) => {
        // Discard the response if the effect was cleaned up before it resolved.
        if (controller.signal.aborted) return;

        const loaded: PlannedService[] = [];
        const ids = new Map<string, string>();

        for (const booking of result.data) {
          // Skip entries whose slot is missing — nothing to place on the grid.
          if (!booking.slot) continue;

          // Validate stored payload; malformed shapes are silently dropped.
          const storedParse = StoredServiceSchema.safeParse(
            booking.resource.data
          );
          const stored = storedParse.success ? storedParse.data : undefined;
          // Keep _anden separate so it is not spread into SelectedService.
          const { _anden, ...storedService } = stored ?? {};

          const service: SelectedService = {
            origen: "",
            lugarCarguio: "",
            destino: "",
            tipoViaje: "Sider",
            ocupacion: 0,
            permanencia: "",
            leadTime: {
              total_lineasoc_cumplen: 0,
              total_lineasoc_incumplen: 0,
              lineasoc_pctn_cumplimiento: 0,
            },
            eta: "",
            incidencias: [],
            observaciones: "",
            prioridad: 0,
            ...storedService,
            // Canonical booking fields always win over stored data
            id: booking.resource.id,
            cliente: booking.resource.label ?? booking.resource.id,
            // Bookings written before mintral_serviceCode was persisted only
            // have the kanban-derived `${code}-${type}` resource id. Recover
            // the code from the prefix so the live-task lookup still works
            // on legacy bookings.
            mintral_serviceCode:
              storedService.mintral_serviceCode ??
              booking.resource.id.split("-")[0],
          };

          loaded.push({
            service,
            slot: {
              date: dayjs(booking.slot.date).toDate(),
              hour: booking.slot.hour,
              minutes: booking.slot.minutes,
              ...(_anden === undefined ? {} : { anden: _anden }),
            },
          });
          ids.set(booking.resource.id, booking.id);
        }

        setPlannedServices(loaded);
        setBookingIds(ids);
        setBookingsLoadError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setPlannedServices([]);
        setBookingIds(new Map());
        const message = tr(
          "pages.planning.sidebar.notifications.bookingsLoadError",
          dict
        );
        setBookingsLoadError(message);
        ShowNotification({ type: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [calendarId, bookingsRange.startDate, bookingsRange.endDate]);

  // Derived arrays from unified state (memoized for performance)
  const timeWindows = useMemo(
    () => timeSlots.filter(isTimeWindow),
    [timeSlots]
  );

  const timeBlocks = useMemo(() => timeSlots.filter(isTimeBlock), [timeSlots]);

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
    // Clear assignment mode when selecting a new slot
    setAssigningService(null);
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
    // Clear assignment mode when selecting a new service from the list
    setAssigningService(null);
  }, []);

  /** Deactivate API windows that were removed from local state; returns error strings. */
  const deactivateRemovedWindows = useCallback(
    async (
      currentApiWindows: typeof apiTimeWindows,
      newWindowIds: Set<string>
    ): Promise<string[]> => {
      if (!calendarId) return [];
      const errors: string[] = [];
      for (const apiWindow of currentApiWindows) {
        if (!newWindowIds.has(apiWindow.id)) {
          try {
            await deactivateCalendarTimeWindow(calendarId, apiWindow);
          } catch (err) {
            errors.push(
              `Failed to deactivate "${apiWindow.name}": ${err instanceof Error ? err.message : "unknown error"}`
            );
          }
        }
      }
      return errors;
    },
    [calendarId]
  );

  /** Create or update local slots (windows AND blocks) against the API; returns error strings. */
  const saveLocalSlots = useCallback(
    async (slots: TimeSlot[], currentIds: Set<string>): Promise<string[]> => {
      if (!calendarId) return [];
      const errors: string[] = [];
      for (const slot of slots) {
        try {
          const body = localToApiTimeWindow(slot);
          if (currentIds.has(slot.id)) {
            await updateCalendarTimeWindow(calendarId, slot.id, body);
          } else {
            await createCalendarTimeWindow(calendarId, body);
          }
        } catch (err) {
          errors.push(
            `Failed to save "${slot.name}": ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      }
      return errors;
    },
    [calendarId]
  );

  // Primary setter: replaces entire unified array and syncs to API
  const setTimeSlotsAndSync = useCallback(
    async (slots: TimeSlot[]) => {
      // Update local state immediately (optimistic update)
      setTimeSlots(slots);

      // Skip API sync when there is no calendarId (generic planning page)
      if (!calendarId) return;

      const currentApiWindows = apiTimeWindows;
      const currentIds = new Set(currentApiWindows.map((w) => w.id));
      // Both kinds round-trip through the API now; track every local id so
      // we don't deactivate a block that's still present.
      const newSlotIds = new Set(slots.map((s) => s.id));

      const [deactivateErrors, saveErrors] = await Promise.all([
        deactivateRemovedWindows(currentApiWindows, newSlotIds),
        saveLocalSlots(slots, currentIds),
      ]);

      // Reload from API to replace temp IDs with real server IDs
      await refreshTimeWindows();

      const errors = [...deactivateErrors, ...saveErrors];
      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }
    },
    [
      calendarId,
      apiTimeWindows,
      refreshTimeWindows,
      deactivateRemovedWindows,
      saveLocalSlots,
    ]
  );

  // Convenience setter: updates only windows, preserves blocks (local state only, no API sync)
  const setTimeWindows = useCallback(
    (windows: TimeWindow[]) => {
      const current = timeSlots;
      const newSlots = [...current.filter(isTimeBlock), ...windows];
      // Update local state only (no API sync)
      setTimeSlots(newSlots);
    },
    [timeSlots]
  );

  // Convenience setter: updates only blocks, preserves windows (local state only, no API sync)
  const setTimeBlocks = useCallback(
    (blocks: TimeBlock[]) => {
      const current = timeSlots;
      const newSlots = [...current.filter(isTimeWindow), ...blocks];
      // Update local state only (no API sync)
      setTimeSlots(newSlots);
    },
    [timeSlots]
  );

  // Sync current time slots to API (called when user clicks "Aplicar")
  const syncTimeSlotsToAPI = useCallback(async () => {
    await setTimeSlotsAndSync(timeSlots);
  }, [timeSlots, setTimeSlotsAndSync]);

  /**
   * Count services assigned within a time window for a specific day
   * Excludes the service being reassigned from the count
   */
  const getServicesInTimeWindow = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const d = dayjs(date);
      const timeRange = TimeWindowUtils.getTimeRange(timeWindow);
      if (!timeRange) return 0;

      const windowStart = timeRange.startHour * 60 + timeRange.startMinutes;
      const windowEnd = timeRange.endHour * 60 + timeRange.endMinutes;

      return plannedServices.filter((ps) => {
        // Exclude the service being reassigned from quota calculation
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          return false;
        }

        // Check same day
        if (!dayjs(ps.slot.date).isSame(d, "day")) return false;

        // Check if service slot is within window time range
        const slotMinutes = ps.slot.hour * 60 + ps.slot.minutes;
        return slotMinutes >= windowStart && slotMinutes < windowEnd;
      }).length;
    },
    [plannedServices, reassigningService]
  );

  /**
   * Get remaining quota for a time window on a specific day
   */
  const getRemainingQuota = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const usedQuota = getServicesInTimeWindow(timeWindow, date);
      return Math.max(0, timeWindow.quota - usedQuota);
    },
    [getServicesInTimeWindow]
  );

  /**
   * Check if a slot falls within any time window
   * Daily-override windows take priority over weekly windows
   */
  const getTimeWindowForSlot = useCallback(
    (date: Date, hour: number, minutes: number): TimeWindow | null => {
      const d = dayjs(date);

      // First, check daily-override windows (they have priority)
      for (const window of timeWindows) {
        if (window.type !== "daily-override") continue;
        if (TimeWindowUtils.matchesSlot(window, d, hour, minutes)) {
          return window;
        }
      }

      // Then check weekly windows
      for (const window of timeWindows) {
        if (window.type === "daily-override") continue;
        if (TimeWindowUtils.matchesSlot(window, d, hour, minutes)) {
          return window;
        }
      }

      return null;
    },
    [timeWindows]
  );

  /**
   * Get all blocks that apply to a specific slot
   * Returns an array for handling overlapping blocks
   */
  const getBlocksForSlot = useCallback(
    (date: Date, hour: number, minutes: number): TimeBlock[] => {
      const d = dayjs(date);
      const matchingBlocks: TimeBlock[] = [];

      // Check daily-override blocks first (they have priority)
      for (const block of timeBlocks) {
        if (block.type === "daily-override") {
          if (TimeWindowUtils.matchesSlot(block, d, hour, minutes)) {
            matchingBlocks.push(block);
          }
        }
      }

      // Then check weekly blocks
      for (const block of timeBlocks) {
        if (block.type === "weekly") {
          if (TimeWindowUtils.matchesSlot(block, d, hour, minutes)) {
            matchingBlocks.push(block);
          }
        }
      }

      return matchingBlocks;
    },
    [timeBlocks]
  );

  /**
   * Check if a slot is blocked by any time block
   * Blocks take priority over quotas
   */
  const isSlotBlocked = useCallback(
    (date: Date, hour: number, minutes: number): boolean => {
      return getBlocksForSlot(date, hour, minutes).length > 0;
    },
    [getBlocksForSlot]
  );

  /**
   * Get which andenes are occupied for a specific time slot
   * Returns array of andén numbers (1-based) that are already assigned
   */
  const getOccupiedAndenes = useCallback(
    (date: Date, hour: number, minutes: number): number[] => {
      const d = dayjs(date);
      const occupied: number[] = [];

      for (const ps of plannedServices) {
        // Exclude the service being reassigned
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          continue;
        }

        // Check if this service is in the same time slot
        if (
          dayjs(ps.slot.date).isSame(d, "day") &&
          ps.slot.hour === hour &&
          ps.slot.minutes === minutes &&
          ps.slot.anden
        ) {
          occupied.push(ps.slot.anden);
        }
      }

      return occupied;
    },
    [plannedServices, reassigningService]
  );

  /**
   * Get available (unoccupied) andenes for a specific time slot
   * Returns array of andén numbers (1-based) that are available
   */
  const getAvailableAndenes = useCallback(
    (date: Date, hour: number, minutes: number): number[] => {
      const occupied = getOccupiedAndenes(date, hour, minutes);
      const available: number[] = [];

      for (let i = 1; i <= andenesCount; i++) {
        if (!occupied.includes(i)) {
          available.push(i);
        }
      }

      return available;
    },
    [getOccupiedAndenes, andenesCount]
  );

  const getServicesForSlot = useCallback(
    (slot: SelectedSlot) => {
      return plannedServices.filter((ps) => {
        // Exclude the service being reassigned from slot count
        if (
          reassigningService &&
          ps.service.id === reassigningService.service.service.id
        ) {
          return false;
        }

        return (
          dayjs(ps.slot.date).isSame(slot.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
        );
      });
    },
    [plannedServices, reassigningService]
  );

  const canAddToSlot = useCallback(
    (slot: SelectedSlot) => {
      const servicesInSlot = getServicesForSlot(slot);
      return servicesInSlot.length < MAX_SERVICES_PER_SLOT;
    },
    [getServicesForSlot]
  );

  const confirmService = useCallback(
    async (
      finalSlot?: SelectedSlot,
      serviceOverrides?: Partial<SelectedService>
    ): Promise<boolean> => {
      // Persist-boundary permission guard. UI surfaces are gated upstream
      // for viewers — a successful call here implies a UI-bypass bug, so
      // throw rather than silently no-op.
      if (!canMutateBookings) {
        throw new Error(
          "confirmService: caller lacks GROUP_PLANNING and GROUP_ASSIGNMENT"
        );
      }
      // Use finalSlot if provided, otherwise fall back to selectedSlot
      const slotToUse = finalSlot ?? selectedSlot;

      if (!slotToUse || !selectedService) {
        return false;
      }

      // Merge any overrides (e.g. serviceCategory) into the service for this confirmation
      const effectiveService = serviceOverrides
        ? { ...selectedService, ...serviceOverrides }
        : selectedService;

      // Check if slot has room (unless re-planning same service)
      const existingInSlot = getServicesForSlot(slotToUse);
      const isReplanning = existingInSlot.some(
        (ps) => ps.service.id === effectiveService.id
      );

      if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
        // Slot is full, cannot add more
        return false;
      }

      // Check if this is a reassignment completion
      const wasReassigning = reassigningService !== null;

      // Capture the original PlannedService before the optimistic update so we
      // can restore it if the backend call fails (reassignment case).
      const originalPlannedService = reassigningService?.service ?? null;

      // Create the new planned service with the final slot (including time and andén)
      const newPlannedService: PlannedService = {
        service: effectiveService,
        slot: slotToUse,
      };

      // Optimistic update: replace the existing entry with the new slot
      setPlannedServices((prev) => {
        const filtered = prev.filter(
          (p) => p.service.id !== effectiveService.id
        );
        const updated = [...filtered, newPlannedService];
        return updated;
      });

      // Resolve the *current* Alfresco task for this service. We never trust
      // a stored taskId — Alfresco mints a new task on every workflow stage
      // advance, so the only safe lookup is by `mintral_serviceCode` against
      // the live kanban index.
      const liveTask = getLiveTask(effectiveService.mintral_serviceCode);

      // Reassignment only changes the slot; the workflow task has already been
      // advanced by a prior plan/assign action. Skip the transition in that
      // case so we don't try to advance a task that's no longer in scope.
      const transitionId = wasReassigning
        ? undefined
        : getNextTransition(liveTask?.stage);
      // Task-driven move:
      //   - PLAN (`Asignar Conductor/Transporte`): attach slot tuple so ECM's
      //     `OnCreateAssignDriverBinding` writes the booking row itself
      //     (ecm-coordinator#266). Presence of these vars also tells
      //     `persistPlannedBooking` to SKIP the BFF booking POST.
      //   - ASSIGN (`Presentar Conductor`): attach resource tuple so ECM's
      //     `OnCreatePresentDriverBinding` reads it from process scope on
      //     the next task's create.
      // `null` for every other case (flag-off origins, missing live task,
      // incomplete tuple) → plain GET advance + BFF booking POST, today's
      // behavior unchanged.
      const planProcessVariables = decidePlanTaskAdvance(
        transitionId,
        effectiveService.origen,
        calendarId,
        slotToUse,
        taskDrivenOrigins
      );
      const assignProcessVariables = decideAssignTaskAdvance(
        transitionId,
        effectiveService.origen,
        effectiveService,
        taskDrivenOrigins
      );
      const processVariables = planProcessVariables ?? assignProcessVariables;
      const taskAdvance: BookingTaskAdvance | undefined =
        transitionId && liveTask?.taskId
          ? {
              taskId: liveTask.taskId,
              transitionId,
              ...(processVariables ? { processVariables } : {}),
            }
          : undefined;

      await persistPlannedBooking({
        calendarId,
        service: effectiveService,
        slot: slotToUse,
        oldBookingId: bookingIds.get(effectiveService.id),
        originalPlannedService,
        liveTaskId: liveTask?.taskId,
        taskAdvance,
        setBookingIds,
        setBookingVersion,
        setPlannedServices,
        refreshSlots,
      });

      // Always clear reassigning state after confirmation
      setReassigningService(null);

      // Clear selection after confirming
      setSelectedSlot(null);
      setSelectedService(null);

      return wasReassigning;
    },
    [
      selectedSlot,
      selectedService,
      getServicesForSlot,
      reassigningService,
      calendarId,
      bookingIds,
      refreshSlots,
      getLiveTask,
      canMutateBookings,
      taskDrivenOrigins,
    ]
  );

  const clearService = useCallback(() => {
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
    setSelectedChipServiceId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
    setAssigningService(null);
    setSelectedChipServiceId(null);
  }, []);

  /**
   * Remove a service from planned services
   */
  const removeService = useCallback(
    async (serviceId: string) => {
      // Persist-boundary permission guard — see confirmService for context.
      if (!canMutateBookings) {
        throw new Error(
          "removeService: caller lacks GROUP_PLANNING and GROUP_ASSIGNMENT"
        );
      }
      // Move the workflow task back toward planService BEFORE cancelling the
      // booking. Resolve the live task by `mintral_serviceCode` against the
      // kanban index — never trust a stored taskId, because Alfresco mints a
      // new task per workflow stage. If the transition fails, bail out so
      // the calendar still shows the service and the user can retry,
      // mirroring the consistency guarantee the bookings POST gives on the
      // forward direction.
      const planned = plannedServices.find((p) => p.service.id === serviceId);
      const liveTask = getLiveTask(planned?.service.mintral_serviceCode);
      if (liveTask) {
        const transition = getUnplanTransition(liveTask.stage);
        if (transition) {
          await advanceWorkflowTask(liveTask.taskId, transition);
        }
      }

      // Cancel the booking in the calendar backend
      const bookingId = bookingIds.get(serviceId);
      if (bookingId) {
        await cancelBooking(bookingId).catch((err) =>
          console.warn("Failed to cancel booking:", err)
        );
        setBookingIds((prev) => {
          const next = new Map(prev);
          next.delete(serviceId);
          return next;
        });
      }

      // Tell the coordinator the service is no longer in this calendar.
      // Task-driven origins skip this call entirely — the ECM listener on
      // the unplan task move reconciles the binding to `none` on its own.
      // Best-effort for flag-off origins: a failure here just leaves a
      // stale binding row in act_ru_variable, which the next planner action
      // on this calendar will overwrite. Don't block the user-visible
      // removal on it.
      const unplanNotification = decideUnplanBindingNotification(
        planned?.service.mintral_serviceCode,
        calendarId,
        planned?.service.origen,
        taskDrivenOrigins
      );
      if (unplanNotification) {
        await notifyCalendarBinding(unplanNotification).catch((err) =>
          console.warn("Failed to notify calendar binding (none):", err)
        );
      }

      // Remove from local state
      setPlannedServices((prev) =>
        prev.filter((p) => p.service.id !== serviceId)
      );

      // Bump version so the service list re-fetches (including newly unbooked)
      setBookingVersion((v) => v + 1);
    },
    [
      bookingIds,
      plannedServices,
      getLiveTask,
      calendarId,
      canMutateBookings,
      taskDrivenOrigins,
    ]
  );

  /**
   * Remove the driver/transport assignment from a planned service. The
   * inverse of the "Asignar" arm of `confirmService`: it reverses the
   * workflow task, drops the assignment tuple from the booking, and tells
   * the coordinator to revert the service to its planned activity state.
   */
  const removeAssignment = useCallback(
    async (serviceId: string) => {
      // Persist-boundary permission guard — see confirmService for context.
      if (!canMutateBookings) {
        throw new Error(
          "removeAssignment: caller lacks GROUP_PLANNING and GROUP_ASSIGNMENT"
        );
      }

      const planned = plannedServices.find((p) => p.service.id === serviceId);
      if (!planned) return;

      // Reverse the workflow task BEFORE touching the booking. Assigning
      // advanced the task `planService → assignDriver`; this steps it back.
      // Resolve the live task by `mintral_serviceCode` against the kanban —
      // never a stored taskId. A failed transition aborts the whole op so
      // the assignment stays visible and the user can retry, mirroring
      // `removeService`.
      const liveTask = getLiveTask(planned.service.mintral_serviceCode);
      if (liveTask) {
        // Task-driven origins at `presentDriver` step back to `assignDriver`
        // via the BPMN's `"Asignar Conductor/Transporte"` outcome — ECM's
        // `OnCreateAssignDriverBinding` listener then reconciles the binding
        // to `unassigned` on its own. Every other case (flag-off origins,
        // pre-migration `assignDriver` stage) falls through to today's
        // unassign map (`assignDriver → planService` via `Planificar Servicio`).
        const transition =
          getTaskDrivenUnassignTransition(
            liveTask.stage,
            planned.service.origen,
            taskDrivenOrigins
          ) ?? getUnassignTransition(liveTask.stage);
        if (transition) {
          await advanceWorkflowTask(liveTask.taskId, transition);
        }
      }

      // Drop the assignment tuple from `cld_bookings.resource_data` so
      // reopening the sidebar starts clean. Uses the plain booking PUT —
      // not `moveBooking` — because the move route would re-derive the
      // binding stage as "planned"; the explicit "unassigned" call below
      // is the stage the coordinator dispatches on.
      const clearedService: SelectedService = {
        ...planned.service,
        assignedCarrier: undefined,
        assignedDriver: undefined,
        assignedDriver2: undefined,
        assignedTruck: undefined,
        assignedTrailer: undefined,
      };
      const bookingId = bookingIds.get(serviceId);
      if (bookingId) {
        await updateBooking(bookingId, {
          resource: buildResource(clearedService, planned.slot),
        });
      }

      // Tell the coordinator the service is back to its planned state.
      // Task-driven origins skip this call entirely — the ECM listener on
      // the unassign task move reconciles the binding to `unassigned` on
      // its own. Best-effort for flag-off origins: a failure leaves a
      // stale binding the next planner action on this calendar overwrites
      // — don't block the user-visible removal on it.
      const unassignNotification = decideUnassignBindingNotification(
        planned.service.mintral_serviceCode,
        calendarId,
        planned.service.origen,
        taskDrivenOrigins
      );
      if (unassignNotification) {
        await notifyCalendarBinding(unassignNotification).catch((err) =>
          console.warn("Failed to notify calendar binding (unassigned):", err)
        );
      }

      // Clear the assignment tuple locally for immediate feedback.
      setPlannedServices((prev) =>
        prev.map((p) =>
          p.service.id === serviceId
            ? { ...p, service: clearedService }
            : p
        )
      );
      setBookingVersion((v) => v + 1);
    },
    [
      bookingIds,
      plannedServices,
      getLiveTask,
      calendarId,
      canMutateBookings,
      taskDrivenOrigins,
    ]
  );

  /**
   * Start reassignment mode - keeps service in original slot until confirmed
   * The service remains visible in its original position with a visual indicator
   */
  const startReassignment = useCallback((plannedService: PlannedService) => {
    // Clear any active assignment mode first (mutually exclusive)
    setAssigningService(null);

    // Store original slot for visual connection and cancellation
    setReassigningService({
      service: plannedService,
      originalSlot: { ...plannedService.slot },
    });

    // Pre-select the service for reassignment (but don't remove from planned services yet)
    setSelectedService(plannedService.service);

    // Keep the original slot selected so the form shows time/category fields.
    // Snap to the 30-minute cell boundary so the time range filter works correctly.
    const snappedMinutes = Math.floor(plannedService.slot.minutes / 30) * 30;
    setSelectedSlot({
      ...plannedService.slot,
      minutes: snappedMinutes,
    });
  }, []);

  /**
   * Cancel reassignment - clear reassigning state without changes
   */
  const cancelReassignment = useCallback(() => {
    // Clear reassigning state (service was never removed, so no need to restore)
    setReassigningService(null);

    // Clear selection
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  /**
   * Start assignment-only mode - opens the sidebar with only Asignación tab available
   * Used when user clicks "Asignar" in context menu for already-planned services
   */
  const startAssignment = useCallback((plannedService: PlannedService) => {
    // Clear any active reassignment mode first (mutually exclusive)
    setReassigningService(null);

    setAssigningService({ service: plannedService });
    setSelectedService(plannedService.service);
    setSelectedSlot(plannedService.slot);
  }, []);

  /**
   * Cancel assignment-only mode - clear assigning state without changes
   */
  const cancelAssignment = useCallback(() => {
    setAssigningService(null);
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  // Left-click on a chip: select only the underlying slot. Clears any
  // previously selected service so the sidebar opens in "add to slot" mode,
  // identical to clicking the empty portion of the slot — never carries the
  // chip's service into the form. Also clears any chip highlight from a
  // prior right-click so the two selection states stay mutually exclusive.
  const selectChipSlot = useCallback((plannedService: PlannedService) => {
    setReassigningService(null);
    setAssigningService(null);
    setSelectedService(null);
    setSelectedChipServiceId(null);
    setSelectedSlot(plannedService.slot);
  }, []);

  // Right-click on a chip: highlight only the chip itself. Does NOT touch
  // `selectedService`/`selectedSlot` (so the sidebar stays where it was)
  // — the chip context menu opens immediately after via use-planning-grid.
  // The highlight persists until a left-click clears it or the sidebar
  // closes.
  const selectChipResource = useCallback((plannedService: PlannedService) => {
    setSelectedChipServiceId(plannedService.service.id);
  }, []);

  // Viewer-only inspection entry point. Mirrors `startAssignment` in that it
  // pre-fills both slot and service so the sidebar has data to render, but
  // does not enter assign/reassign mode — the sidebar's read-only path
  // suppresses every mutation surface. Wired from `use-planning-grid` when
  // the caller has `GROUP_CALENDAR_VIEWER` and neither plan nor assign.
  const inspectPlannedService = useCallback(
    (plannedService: PlannedService) => {
      setReassigningService(null);
      setAssigningService(null);
      setSelectedChipServiceId(plannedService.service.id);
      setSelectedService(plannedService.service);
      setSelectedSlot(plannedService.slot);
    },
    []
  );

  const clearChipSelection = useCallback(() => {
    setSelectedChipServiceId(null);
  }, []);

  const isChipSelected = useCallback(
    (serviceId: string) => selectedChipServiceId === serviceId,
    [selectedChipServiceId]
  );

  /**
   * Patch a planned service's assignment tuple client-side.
   *
   * Any key present in `patch` — even with value `undefined` — is merged onto
   * the service, so callers clear a slot by passing `{ assignedDriver:
   * undefined }`. Keys absent from `patch` are untouched. No backend round-
   * trip; persistence rides on the next `confirmService` via the extended
   * `StoredServiceSchema`.
   */
  const updateServiceAssignment = useCallback(
    (
      serviceId: string,
      patch: Partial<
        Pick<
          SelectedService,
          | "assignedCarrier"
          | "assignedDriver"
          | "assignedDriver2"
          | "assignedTruck"
          | "assignedTrailer"
        >
      >
    ) => {
      setPlannedServices((prev) =>
        prev.map((ps) =>
          ps.service.id === serviceId
            ? { ...ps, service: { ...ps.service, ...patch } }
            : ps
        )
      );
    },
    []
  );

  // Sidebar is open when either a slot or service is selected
  const isSidebarOpen = selectedSlot !== null || selectedService !== null;

  const contextValue = useMemo(
    () => ({
      calendarId,
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
      assigningService,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeSlots: setTimeSlotsAndSync,
      setTimeWindows,
      setTimeBlocks,
      setAndenesCount,
      syncTimeSlotsToAPI,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSlotBlocked,
      getBlocksForSlot,
      getOccupiedAndenes,
      getAvailableAndenes,
      isSidebarOpen,
      removeService,
      removeAssignment,
      startReassignment,
      cancelReassignment,
      startAssignment,
      cancelAssignment,
      selectChipSlot,
      selectChipResource,
      inspectPlannedService,
      isChipSelected,
      clearChipSelection,
      updateServiceAssignment,
      bookingsLoadError,
      backendSlots,
      isSlotsLoading,
      refreshSlots,
      bookingVersion,
      getLiveTask,
    }),
    [
      calendarId,
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
      assigningService,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeSlotsAndSync,
      setTimeWindows,
      setTimeBlocks,
      setAndenesCount,
      syncTimeSlotsToAPI,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSlotBlocked,
      getBlocksForSlot,
      getOccupiedAndenes,
      getAvailableAndenes,
      isSidebarOpen,
      removeService,
      removeAssignment,
      startReassignment,
      cancelReassignment,
      startAssignment,
      cancelAssignment,
      selectChipSlot,
      selectChipResource,
      inspectPlannedService,
      isChipSelected,
      clearChipSelection,
      updateServiceAssignment,
      bookingsLoadError,
      backendSlots,
      isSlotsLoading,
      refreshSlots,
      bookingVersion,
      getLiveTask,
    ]
  );

  return (
    <PlanningSelectionContext.Provider value={contextValue}>
      {children}
    </PlanningSelectionContext.Provider>
  );
}

export function usePlanningSelection() {
  const context = useContext(PlanningSelectionContext);
  if (!context) {
    throw new Error(
      "usePlanningSelection must be used within a PlanningSelectionProvider"
    );
  }
  return context;
}
