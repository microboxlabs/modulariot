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
  endHour: number,
  slotDurationMinutes = 30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const totalMinutes = (endHour - startHour) * 60;
  const slotCount = Math.floor(totalMinutes / slotDurationMinutes);

  for (let i = 0; i < slotCount; i++) {
    const minutesFromStart = i * slotDurationMinutes;
    const hour = startHour + Math.floor(minutesFromStart / 60);
    const minutes = minutesFromStart % 60;
    const hourStr = hour.toString().padStart(2, "0");
    const minStr = minutes.toString().padStart(2, "0");
    slots.push({ hour, minutes, label: `${hourStr}:${minStr}` });
  }
  return slots;
}
