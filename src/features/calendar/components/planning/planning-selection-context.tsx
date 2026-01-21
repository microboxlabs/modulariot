"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

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
 * Time window configuration for quota management
 *
 * Types:
 * - "weekly": Uses weeklyPattern string format "W1-4 1-5 0900-1700"
 *   - W1-4: Weeks 1-4 of the month (W* for all weeks)
 *   - 1-5: Days 1 (Monday) to 5 (Friday)
 *   - 0900-1700: Time range in HHMM format
 *
 * - "daily-override": Uses ISO timestamps for specific date ranges
 *   - Overrides weekly windows for the specified date/time
 */
export interface TimeWindow {
  id: string;
  name: string;
  type: "weekly" | "daily-override";
  quota: number;
  color?: TimeWindowColor;
  // For weekly type: pattern string like "W1-4 1-5 0900-1700"
  weeklyPattern?: string;
  // For daily-override type: ISO timestamps
  startTimestamp?: string; // ISO 8601 format: "2026-01-20T09:00:00"
  endTimestamp?: string; // ISO 8601 format: "2026-01-20T17:00:00"
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
    const match = pattern.match(
      /^W(\*|[\d,-]+)\s+([\d,-]+)\s+(\d{4})-(\d{4})$/
    );
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
    const startHour = parseInt(startTime.slice(0, 2), 10);
    const startMinutes = parseInt(startTime.slice(2, 4), 10);
    const endHour = parseInt(endTime.slice(0, 2), 10);
    const endMinutes = parseInt(endTime.slice(2, 4), 10);

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
      return `${prefix}${sorted[0]}-${sorted[sorted.length - 1]}`;
    }
    return `${prefix}${sorted.join(",")}`;
  },

  /**
   * Check if a time window matches a specific slot
   */
  matchesSlot(
    window: TimeWindow,
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
    window: TimeWindow,
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
    window: TimeWindow,
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
   * Get time range from a window (works for both types)
   */
  getTimeRange(
    window: TimeWindow
  ): {
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
   * Get the date for a daily-override window
   */
  getDate(window: TimeWindow): string | null {
    if (window.type !== "daily-override" || !window.startTimestamp) return null;
    return dayjs(window.startTimestamp).format("YYYY-MM-DD");
  },

  /**
   * Check if a daily-override window is expired (before today)
   */
  isExpired(window: TimeWindow): boolean {
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

/**
 * Lead time status for a service
 */
export type LeadTimeStatus = "on_time" | "warning" | "delayed";

/**
 * Trip type options
 */
export type TripType = "Sider" | "Doble Sider" | "Rampla";

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
  leadTime: {
    deadline: string; // ISO date
    status: LeadTimeStatus;
  };
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  observaciones: string;
  prioridad: number;
}

/**
 * A service that has been confirmed and placed in a slot
 */
export interface PlannedService {
  service: SelectedService;
  slot: SelectedSlot;
}

interface PlanningSelectionContextType {
  selectedSlot: SelectedSlot | null;
  selectedService: SelectedService | null;
  plannedServices: PlannedService[];
  timeWindows: TimeWindow[];
  selectSlot: (slot: SelectedSlot) => void;
  selectService: (service: SelectedService) => void;
  confirmService: () => void;
  clearService: () => void;
  closeSidebar: () => void;
  clearSelection: () => void;
  getServicesForSlot: (slot: SelectedSlot) => PlannedService[];
  canAddToSlot: (slot: SelectedSlot) => boolean;
  setTimeWindows: (windows: TimeWindow[]) => void;
  getTimeWindowForSlot: (
    date: Date,
    hour: number,
    minutes: number
  ) => TimeWindow | null;
  getRemainingQuota: (timeWindow: TimeWindow, date: Date) => number;
  isSidebarOpen: boolean;
}

const MAX_SERVICES_PER_SLOT = 3;

const PlanningSelectionContext =
  createContext<PlanningSelectionContextType | null>(null);

interface PlanningSelectionProviderProps {
  readonly children: ReactNode;
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
}: PlanningSelectionProviderProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedService, setSelectedService] =
    useState<SelectedService | null>(null);
  const [plannedServices, setPlannedServices] = useState<PlannedService[]>([]);
  const [timeWindows, setTimeWindowsState] = useState<TimeWindow[]>([]);

  const selectSlot = useCallback((slot: SelectedSlot) => {
    setSelectedSlot(slot);
  }, []);

  const selectService = useCallback((service: SelectedService) => {
    setSelectedService(service);
  }, []);

  const setTimeWindows = useCallback((windows: TimeWindow[]) => {
    setTimeWindowsState(windows);
  }, []);

  /**
   * Count services assigned within a time window for a specific day
   */
  const getServicesInTimeWindow = useCallback(
    (timeWindow: TimeWindow, date: Date): number => {
      const d = dayjs(date);
      const timeRange = TimeWindowUtils.getTimeRange(timeWindow);
      if (!timeRange) return 0;

      const windowStart = timeRange.startHour * 60 + timeRange.startMinutes;
      const windowEnd = timeRange.endHour * 60 + timeRange.endMinutes;

      return plannedServices.filter((ps) => {
        // Check same day
        if (!dayjs(ps.slot.date).isSame(d, "day")) return false;

        // Check if service slot is within window time range
        const slotMinutes = ps.slot.hour * 60 + ps.slot.minutes;
        return slotMinutes >= windowStart && slotMinutes < windowEnd;
      }).length;
    },
    [plannedServices]
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

  const getServicesForSlot = useCallback(
    (slot: SelectedSlot) => {
      return plannedServices.filter(
        (ps) =>
          dayjs(ps.slot.date).isSame(slot.date, "day") &&
          ps.slot.hour === slot.hour &&
          ps.slot.minutes === slot.minutes
      );
    },
    [plannedServices]
  );

  const canAddToSlot = useCallback(
    (slot: SelectedSlot) => {
      const servicesInSlot = getServicesForSlot(slot);
      return servicesInSlot.length < MAX_SERVICES_PER_SLOT;
    },
    [getServicesForSlot]
  );

  const confirmService = useCallback(() => {
    if (selectedSlot && selectedService) {
      // Check if slot has room (unless re-planning same service)
      const existingInSlot = getServicesForSlot(selectedSlot);
      const isReplanning = existingInSlot.some(
        (ps) => ps.service.id === selectedService.id
      );

      if (!isReplanning && existingInSlot.length >= MAX_SERVICES_PER_SLOT) {
        // Slot is full, cannot add more
        return;
      }

      setPlannedServices((prev) => {
        // Remove if already planned (allow re-planning)
        const filtered = prev.filter(
          (p) => p.service.id !== selectedService.id
        );
        return [...filtered, { service: selectedService, slot: selectedSlot }];
      });
      // Clear selection after confirming
      setSelectedSlot(null);
      setSelectedService(null);
    }
  }, [selectedSlot, selectedService, getServicesForSlot]);

  const clearService = useCallback(() => {
    setSelectedService(null);
  }, []);

  const closeSidebar = useCallback(() => {
    setSelectedSlot(null);
    setSelectedService(null);
  }, []);

  const clearSelection = useCallback(() => {
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
      timeWindows,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeWindows,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSidebarOpen,
    }),
    [
      selectedSlot,
      selectedService,
      plannedServices,
      timeWindows,
      selectSlot,
      selectService,
      confirmService,
      clearService,
      closeSidebar,
      clearSelection,
      getServicesForSlot,
      canAddToSlot,
      setTimeWindows,
      getTimeWindowForSlot,
      getRemainingQuota,
      isSidebarOpen,
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
