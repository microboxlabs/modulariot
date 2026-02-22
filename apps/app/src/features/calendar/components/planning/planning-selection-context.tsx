"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {
  useCalendarTimeWindows,
  createCalendarTimeWindow,
  updateCalendarTimeWindow,
  deactivateCalendarTimeWindow,
  createBooking,
  cancelBooking,
  listBookings,
} from "@/features/common/providers/client-api.provider";
import type { BookingRequest } from "@microboxlabs/miot-calendar-client";
import {
  apiToLocalTimeWindow,
  localToApiTimeWindow,
  TimeWindowResponseSchema,
} from "@/features/calendar/services/time-window.service";

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
  cliente: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
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
}

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

interface PlanningSelectionContextType {
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
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  /** Confirm service assignment. Pass finalSlot to override the selected slot with specific time/andén */
  confirmService: (finalSlot?: SelectedSlot) => Promise<boolean>;
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
  startReassignment: (plannedService: PlannedService) => void;
  cancelReassignment: () => void;
}

const MAX_SERVICES_PER_SLOT = 99;

const PlanningSelectionContext =
  createContext<PlanningSelectionContextType | null>(null);

interface PlanningSelectionProviderProps {
  readonly children: ReactNode;
  readonly calendarId?: string;
}

/**
 * Gets the week number of the month (1-5) for a given date
 */
function getWeekOfMonth(date: dayjs.Dayjs): number {
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
}: PlanningSelectionProviderProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  const [plannedServices, setPlannedServices] = useState<PlannedService[]>([]);
  // Unified state: single array for all time slots
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  // Number of andenes (platforms) available
  const [andenesCount, setAndenesCount] = useState<number>(1);
  const [reassigningService, setReassigningService] =
    useState<ReassigningService | null>(null);
  const [bookingIds, setBookingIds] = useState<Map<string, string>>(
    new Map()
  ); // Map of service.id -> booking.id from calendar backend

  // Load time windows from the miot-calendar-client backend
  const {
    timeWindows: apiTimeWindows,
    error: timeSlotsError,
    refresh: refreshTimeWindows,
  } = useCalendarTimeWindows(calendarId ?? null);

  // Sync time windows from API to local state (only when there's no error)
  useEffect(() => {
    if (timeSlotsError) return;

    if (apiTimeWindows.length > 0) {
      setTimeSlots(
        apiTimeWindows.flatMap((tw) => {
          const result = TimeWindowResponseSchema.safeParse(tw);
          if (!result.success) {
            console.warn("Skipping invalid time window response", tw, result.error.message);
            return [];
          }
          return [apiToLocalTimeWindow(result.data)];
        })
      );
    } else if (apiTimeWindows.length === 0 && !timeSlotsError) {
      setTimeSlots([]);
    }
  }, [apiTimeWindows, timeSlotsError]);

  // Load existing bookings from the backend when a calendar is selected
  useEffect(() => {
    if (!calendarId) return;

    listBookings({ calendarId }).then((result) => {
      const loaded: PlannedService[] = [];
      const ids = new Map<string, string>();

      for (const booking of result.data) {
        const stored = booking.resource.data as Partial<SelectedService> | undefined;
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
          ...(stored ?? {}),
          // Canonical booking fields always win over stored data
          id: booking.resource.id,
          cliente: booking.resource.label ?? booking.resource.id,
        };

        loaded.push({
          service,
          slot: {
            date: new Date(booking.slot.date),
            hour: booking.slot.hour,
            minutes: booking.slot.minutes,
          },
        });
        ids.set(booking.resource.id, booking.id);
      }

      setPlannedServices(loaded);
      setBookingIds(ids);
    }).catch((err) => {
      console.warn("Failed to load existing bookings:", err);
    });
  }, [calendarId]);

  // Derived arrays from unified state (memoized for performance)
  const timeWindows = useMemo(
    () => timeSlots.filter(isTimeWindow),
    [timeSlots]
  );

  const timeBlocks = useMemo(() => timeSlots.filter(isTimeBlock), [timeSlots]);

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
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

  /** Create or update local window slots against the API; returns error strings. */
  const saveLocalWindows = useCallback(
    async (slots: TimeSlot[], currentIds: Set<string>): Promise<string[]> => {
      if (!calendarId) return [];
      const errors: string[] = [];
      for (const slot of slots) {
        if (slot.kind !== "window") continue; // blocks are local-only
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
      const newWindowIds = new Set(
        slots.filter((s) => s.kind === "window").map((s) => s.id)
      );

      const [deactivateErrors, saveErrors] = await Promise.all([
        deactivateRemovedWindows(currentApiWindows, newWindowIds),
        saveLocalWindows(slots, currentIds),
      ]);

      // Reload from API to replace temp IDs with real server IDs
      await refreshTimeWindows();

      const errors = [...deactivateErrors, ...saveErrors];
      if (errors.length > 0) {
        throw new Error(errors.join("; "));
      }
    },
    [calendarId, apiTimeWindows, refreshTimeWindows, deactivateRemovedWindows, saveLocalWindows]
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
    async (finalSlot?: SelectedSlot): Promise<boolean> => {
      // Use finalSlot if provided, otherwise fall back to selectedSlot
      const slotToUse = finalSlot ?? selectedSlot;

      if (slotToUse && selectedService) {
        // Check if slot has room (unless re-planning same service)
        const existingInSlot = getServicesForSlot(slotToUse);
        const isReplanning = existingInSlot.some(
          (ps) => ps.service.id === selectedService.id
        );

        if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
          // Slot is full, cannot add more
          return false;
        }

        // Check if this is a reassignment completion
        const wasReassigning = reassigningService !== null;

        // Create the new planned service with the final slot (including time and andén)
        const newPlannedService: PlannedService = {
          service: selectedService,
          slot: slotToUse,
        };

        // Update local state
        setPlannedServices((prev) => {
          const filtered = prev.filter(
            (p) => p.service.id !== selectedService.id
          );
          return [...filtered, newPlannedService];
        });

        // Create / reassign booking in the calendar backend
        if (calendarId) {
          try {
            const bookingBody: BookingRequest = {
              calendarId,
              resource: {
                id: selectedService.id,
                type: "service",
                label: selectedService.cliente,
                data: selectedService as unknown as Record<string, unknown>,
              },
              slot: {
                date: dayjs(slotToUse.date).format("YYYY-MM-DD"),
                hour: slotToUse.hour,
                minutes: slotToUse.minutes,
              },
            };

            // Cancel old booking on reassignment
            const oldBookingId = bookingIds.get(selectedService.id);
            if (oldBookingId) {
              await cancelBooking(oldBookingId).catch((err) =>
                console.warn("Failed to cancel old booking:", err)
              );
            }

            const booking = await createBooking(bookingBody);
            setBookingIds((prev) => {
              const next = new Map(prev);
              next.set(selectedService.id, booking.id);
              return next;
            });
          } catch (err) {
            console.warn("Failed to create booking:", err);
          }
        }

        // Always clear reassigning state after confirmation
        setReassigningService(null);

        // Clear selection after confirming
        setSelectedSlot(null);
        setSelectedService(null);

        return wasReassigning;
      }
      return false;
    },
    [
      selectedSlot,
      selectedService,
      getServicesForSlot,
      reassigningService,
      calendarId,
      bookingIds,
    ]
  );

  const clearService = useCallback(() => {
    setSelectedService(null);
    setReassigningService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
    setReassigningService(null);
  }, []);

  /**
   * Remove a service from planned services
   */
  const removeService = useCallback(
    async (serviceId: string) => {
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

      // Remove from local state
      setPlannedServices((prev) =>
        prev.filter((p) => p.service.id !== serviceId)
      );
    },
    [bookingIds]
  );

  /**
   * Start reassignment mode - keeps service in original slot until confirmed
   * The service remains visible in its original position with a visual indicator
   */
  const startReassignment = useCallback((plannedService: PlannedService) => {
    // Store original slot for visual connection and cancellation
    setReassigningService({
      service: plannedService,
      originalSlot: { ...plannedService.slot },
    });

    // Pre-select the service for reassignment (but don't remove from planned services yet)
    setSelectedService(plannedService.service);

    // Clear any previously selected slot so user can pick a new one
    setSelectedSlot(null);
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

  // Sidebar is open when either a slot or service is selected
  const isSidebarOpen = selectedSlot !== null || selectedService !== null;

  const contextValue = useMemo(
    () => ({
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
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
      startReassignment,
      cancelReassignment,
    }),
    [
      selectedSlot,
      selectedService,
      plannedServices,
      timeSlots,
      timeWindows,
      timeBlocks,
      andenesCount,
      reassigningService,
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
      startReassignment,
      cancelReassignment,
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
