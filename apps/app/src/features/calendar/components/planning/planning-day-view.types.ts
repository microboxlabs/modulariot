import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

// Reuse TimeSlot from week view
export type { TimeSlot } from "./planning-week-view.types";

export interface PlanningDayViewProps {
  lang: string;
  dict: I18nDictionary;
  currentDate?: Date;
  startHour?: number;
  endHour?: number;
  slotDurationMinutes?: number;
}

export interface DayInfo {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  isToday: boolean;
}
