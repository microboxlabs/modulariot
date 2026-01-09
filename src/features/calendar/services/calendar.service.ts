import type { TimeSlot } from "./calendar.service.types";

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
