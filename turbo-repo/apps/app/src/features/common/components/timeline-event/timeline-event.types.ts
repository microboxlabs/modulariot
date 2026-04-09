/** Shared urgency level used across features (fleet events, collaborator behavior, etc.) */
export type EventUrgency = "critical" | "warning" | "info";

/** Style configuration for each urgency level */
export interface UrgencyStyle {
  className: string;
  labelKey: string;
  dotColor: string;
}

/** Shared urgency styles — CSS classes and i18n label keys */
export const URGENCY_STYLES: Record<EventUrgency, UrgencyStyle> = {
  critical: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    labelKey: "urgency.critical",
    dotColor: "bg-red-500 dark:bg-red-400",
  },
  warning: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    labelKey: "urgency.warning",
    dotColor: "bg-yellow-500 dark:bg-yellow-400",
  },
  info: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    labelKey: "urgency.info",
    dotColor: "bg-blue-500 dark:bg-blue-400",
  },
};
