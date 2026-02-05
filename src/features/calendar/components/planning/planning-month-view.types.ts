import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export interface PlanningMonthViewProps {
  lang: string;
  dict: I18nDictionary;
  currentDate?: Date;
}

export interface MonthDay {
  date: Date;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}
