import type { I18nDictionary } from "@/features/i18n/i18n.service.types";

export type ViewMode = "day" | "week" | "month";

export interface PlanningHeaderProps {
  lang: string;
  dict: I18nDictionary;
  initialDate?: Date;
  initialViewMode?: ViewMode;
  onDateChange?: (date: Date) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}
