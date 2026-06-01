import dayjs from "dayjs";
import type { TimeSlot, ViewMode } from "./calendar.service.types";

export const DATE_FORMAT = "YYYY-MM-DD";
export const VIEW_MODES = new Set<ViewMode>(["day", "week", "month"]);

export function isValidViewMode(value: string | null): value is ViewMode {
  return value !== null && VIEW_MODES.has(value as ViewMode);
}

/**
 * Parse a date string from URL parameter
 * Returns null if string is null or invalid
 */
export function parseUrlDate(dateStr: string | null): dayjs.Dayjs | null {
  if (!dateStr) return null;
  const parsed = dayjs(dateStr, DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

export function generateTimeSlots(
  startHour: number,
  endHour: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    const hourStr = hour.toString().padStart(2, "0");
    slots.push(
      { hour, minutes: 0, label: `${hourStr}:00` },
      { hour, minutes: 30, label: `${hourStr}:30` }
    );
  }
  return slots;
}
