import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export interface PlanningWeekViewProps {
  lang: string;
  dict: I18nDictionary;
  currentDate?: Date;
  startHour?: number;
  endHour?: number;
}

export interface TimeSlot {
  hour: number;
  minutes: number;
  label: string;
}

export interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}
