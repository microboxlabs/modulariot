import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);

/**
 * Available color presets for time windows.
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
 * Get the week-of-month (1-5) for a date, anchored on ISO Mondays so it uses the
 * exact same definition the weekly-pattern matcher does — otherwise the
 * planner and the overlay would disagree on which dates a `W1`/`W2…` TW covers.
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
    if (!weeksStr || !daysStr || !startTime || !endTime) return null;

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
        if (start === undefined || end === undefined) continue;
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
      sorted.every((n, i) => i === 0 || n === (sorted[i - 1] ?? 0) + 1);

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
