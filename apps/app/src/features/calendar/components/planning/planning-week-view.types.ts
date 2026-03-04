import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

// Re-export TimeSlot from calendar service
export type { TimeSlot } from "@/features/calendar/services/calendar.service.types";

export interface PlanningWeekViewProps {
  lang: string;
  dict: I18nDictionary;
  currentDate?: Date;
  startHour?: number;
  endHour?: number;
  slotDurationMinutes?: number;
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}
