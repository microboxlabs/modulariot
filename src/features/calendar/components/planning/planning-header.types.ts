import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import type { ViewMode } from "@/features/calendar/services/calendar.service.types";

// Re-export ViewMode from calendar service
export type { ViewMode };

export interface PlanningHeaderProps {
  lang: string;
  dict: I18nDictionary;
  initialDate?: Date;
  initialViewMode?: ViewMode;
  onDateChange?: (date: Date) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}
