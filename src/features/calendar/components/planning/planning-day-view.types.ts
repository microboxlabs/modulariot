// Reuse TimeSlot from week view
export type { TimeSlot } from "./planning-week-view.types";

export interface PlanningDayViewProps {
  lang: string;
  currentDate?: Date;
  startHour?: number;
  endHour?: number;
}

export interface DayInfo {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  isToday: boolean;
}
