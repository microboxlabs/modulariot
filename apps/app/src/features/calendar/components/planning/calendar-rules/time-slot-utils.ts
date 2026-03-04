import dayjs from "dayjs";
import type { ParsedWeeklyPattern } from "../planning-selection-context";
import { TimeWindowUtils } from "../planning-selection-context";

const MIN_HOUR = 0;
const MAX_HOUR = 23;

/** Days using format standard: 1=Monday, 7=Sunday */
export const DAYS_OF_WEEK = [
  { value: 1, label: "L", fullLabel: "Lunes" },
  { value: 2, label: "M", fullLabel: "Martes" },
  { value: 3, label: "X", fullLabel: "Miércoles" },
  { value: 4, label: "J", fullLabel: "Jueves" },
  { value: 5, label: "V", fullLabel: "Viernes" },
  { value: 6, label: "S", fullLabel: "Sábado" },
  { value: 7, label: "D", fullLabel: "Domingo" },
] as const;

export const WEEKS_OF_MONTH = [
  { value: 1, label: "S1", fullLabel: "Semana 1" },
  { value: 2, label: "S2", fullLabel: "Semana 2" },
  { value: 3, label: "S3", fullLabel: "Semana 3" },
  { value: 4, label: "S4", fullLabel: "Semana 4" },
  { value: 5, label: "S5", fullLabel: "Semana 5" },
] as const;

export interface TimeOption {
  value: string;
  label: string;
}

/**
 * Generate time options based on slot duration
 * @param minHour - Minimum hour (default: 0)
 * @param maxHour - Maximum hour (default: 23)
 * @param slotDurationMinutes - Slot duration in minutes (default: 30)
 */
export function generateTimeOptions(
  minHour = MIN_HOUR,
  maxHour = MAX_HOUR,
  slotDurationMinutes = 30
): TimeOption[] {
  const options: TimeOption[] = [];
  const totalMinutes = (maxHour + 1) * 60; // Include the last hour
  const startMinutes = minHour * 60;

  for (let mins = startMinutes; mins < totalMinutes; mins += slotDurationMinutes) {
    const hour = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hour > maxHour) break;
    const value = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    options.push({ value, label: value });
  }
  // Always include the end of day option if not already included
  const lastOption = options[options.length - 1];
  if (lastOption?.value !== `${maxHour.toString().padStart(2, "0")}:00`) {
    options.push({ value: `${maxHour.toString().padStart(2, "0")}:00`, label: `${maxHour.toString().padStart(2, "0")}:00` });
  }
  return options;
}

export function parseTime(timeStr: string): { hour: number; minutes: number } {
  const [hour, minutes] = timeStr.split(":").map(Number);
  return { hour, minutes };
}

export function formatTime(hour: number, minutes: number): string {
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function timeToMinutes(hour: number, minutes: number): number {
  return hour * 60 + minutes;
}

export interface TimeRangeAdjustment {
  startHour: number;
  startMinutes: number;
  endHour: number;
  endMinutes: number;
}

/**
 * Adjust time range to ensure start < end, with minimum gap based on slot duration
 * @param pattern - Current time pattern
 * @param field - Which field is being changed ("start" or "end")
 * @param hour - New hour value
 * @param minutes - New minutes value
 * @param slotDurationMinutes - Minimum gap in minutes (default: 30)
 */
export function adjustTimeRange(
  pattern: ParsedWeeklyPattern,
  field: "start" | "end",
  hour: number,
  minutes: number,
  slotDurationMinutes = 30
): TimeRangeAdjustment {
  let { startHour, startMinutes, endHour, endMinutes } = pattern;

  if (field === "start") {
    const newStartMin = timeToMinutes(hour, minutes);
    const endMin = timeToMinutes(endHour, endMinutes);
    if (newStartMin >= endMin) {
      const adjustedEnd = newStartMin + slotDurationMinutes;
      endHour = Math.min(Math.floor(adjustedEnd / 60), MAX_HOUR);
      endMinutes = endHour === MAX_HOUR ? 0 : adjustedEnd % 60;
    }
    startHour = hour;
    startMinutes = minutes;
  } else {
    const startMin = timeToMinutes(startHour, startMinutes);
    const newEndMin = timeToMinutes(hour, minutes);
    if (newEndMin <= startMin) {
      const adjustedStart = Math.max(newEndMin - slotDurationMinutes, 0);
      startHour = Math.floor(adjustedStart / 60);
      startMinutes = adjustedStart % 60;
    }
    endHour = hour;
    endMinutes = minutes;
  }

  return { startHour, startMinutes, endHour, endMinutes };
}

/** Base type for time slot items (TimeWindow or TimeBlock) */
export interface TimeSlotBase {
  id: string;
  name: string;
  kind: "window" | "block";
  type: "weekly" | "daily-override";
  weeklyPattern?: string;
  startTimestamp?: string;
  endTimestamp?: string;
}

/**
 * Get parsed weekly pattern or default values for any time slot
 */
export function getSlotPattern<T extends TimeSlotBase>(
  slot: T
): ParsedWeeklyPattern {
  if (slot.type === "weekly" && slot.weeklyPattern) {
    const parsed = TimeWindowUtils.parseWeeklyPattern(slot.weeklyPattern);
    if (parsed) return parsed;
  }
  if (slot.type === "daily-override") {
    const timeRange = TimeWindowUtils.getTimeRange(slot);
    if (timeRange) {
      return {
        weeks: [],
        days: [],
        ...timeRange,
      };
    }
  }
  return {
    weeks: [],
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    startMinutes: 0,
    endHour: 12,
    endMinutes: 0,
  };
}

/**
 * Build a weekly time slot with updated pattern
 */
export function buildWeeklySlot<T extends TimeSlotBase>(
  slot: T,
  pattern: ParsedWeeklyPattern
): T {
  return {
    ...slot,
    type: "weekly" as const,
    startTimestamp: undefined,
    endTimestamp: undefined,
    weeklyPattern: TimeWindowUtils.buildWeeklyPattern(
      pattern.weeks,
      pattern.days,
      pattern.startHour,
      pattern.startMinutes,
      pattern.endHour,
      pattern.endMinutes
    ),
  };
}

/**
 * Build a daily-override time slot with updated timestamps
 */
export function buildDailyOverrideSlot<T extends TimeSlotBase>(
  slot: T,
  date: dayjs.Dayjs,
  startHour: number,
  startMinutes: number,
  endHour: number,
  endMinutes: number
): T {
  return {
    ...slot,
    type: "daily-override" as const,
    weeklyPattern: undefined,
    startTimestamp: date
      .hour(startHour)
      .minute(startMinutes)
      .second(0)
      .format("YYYY-MM-DDTHH:mm:ss"),
    endTimestamp: date
      .hour(endHour)
      .minute(endMinutes)
      .second(0)
      .format("YYYY-MM-DDTHH:mm:ss"),
  };
}

/**
 * Check if two time slots have overlapping days
 */
export function hasOverlappingDays<T extends TimeSlotBase>(
  a: T,
  b: T
): boolean {
  const aPattern = getSlotPattern(a);
  const bPattern = getSlotPattern(b);
  return aPattern.days.some((day) => bPattern.days.includes(day));
}

/**
 * Check if two time slots have overlapping weeks
 * Empty weeks array means "all weeks"
 */
export function hasOverlappingWeeks<T extends TimeSlotBase>(
  a: T,
  b: T
): boolean {
  const aPattern = getSlotPattern(a);
  const bPattern = getSlotPattern(b);
  if (aPattern.weeks.length === 0 || bPattern.weeks.length === 0) return true;
  return aPattern.weeks.some((week) => bPattern.weeks.includes(week));
}

/**
 * Check if two time ranges overlap
 */
export function hasOverlappingTime<T extends TimeSlotBase>(
  a: T,
  b: T
): boolean {
  const aPattern = getSlotPattern(a);
  const bPattern = getSlotPattern(b);
  const aStart = timeToMinutes(aPattern.startHour, aPattern.startMinutes);
  const aEnd = timeToMinutes(aPattern.endHour, aPattern.endMinutes);
  const bStart = timeToMinutes(bPattern.startHour, bPattern.startMinutes);
  const bEnd = timeToMinutes(bPattern.endHour, bPattern.endMinutes);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Check if two time slots collide (overlap in days, weeks, AND time)
 * Daily-override slots don't collide - they override weekly slots instead
 */
export function slotsCollide<T extends TimeSlotBase>(a: T, b: T): boolean {
  if (a.type === "daily-override" || b.type === "daily-override") {
    return false;
  }
  return (
    hasOverlappingDays(a, b) &&
    hasOverlappingWeeks(a, b) &&
    hasOverlappingTime(a, b)
  );
}

/**
 * Get IDs of slots that collide with the given slot
 */
export function getCollidingSlotIds<T extends TimeSlotBase>(
  slot: T,
  allSlots: T[]
): string[] {
  return allSlots
    .filter((s) => s.id !== slot.id && slotsCollide(slot, s))
    .map((s) => s.id);
}

/**
 * Calculate which slots have collisions (only weekly vs weekly)
 */
export function calculateCollisions<T extends TimeSlotBase>(
  slots: T[]
): Set<string> {
  const collisions = new Set<string>();
  const weeklySlots = slots.filter((s) => s.type === "weekly");
  for (const slot of weeklySlots) {
    const collidingIds = getCollidingSlotIds(slot, weeklySlots);
    if (collidingIds.length > 0) {
      collisions.add(slot.id);
      collidingIds.forEach((id) => collisions.add(id));
    }
  }
  return collisions;
}
