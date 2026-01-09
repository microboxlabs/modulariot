import type { TimeSlot, ViewMode } from "./calendar.service.types";

export const DATE_FORMAT = "YYYY-MM-DD";
export const VIEW_MODES = new Set<ViewMode>(["day", "week", "month"]);

export function isValidViewMode(value: string | null): value is ViewMode {
  return value !== null && VIEW_MODES.has(value as ViewMode);
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
