"use client";

import { twMerge } from "tailwind-merge";

// Re-export from common components for backward compatibility
export {
  KpiRow,
  ProgressBar,
  LeadTimeDisplay,
  type LeadTimeData,
  getLeadTimeStatus,
} from "@/features/common/components/kpi-display";

interface FormSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * A section divider with title for the planning form
 */
export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={twMerge("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

interface InfoRowProps {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly className?: string;
}

/**
 * A simple label-value row for displaying information
 */
export function InfoRow({ label, value, className }: InfoRowProps) {
  return (
    <div
      className={twMerge("flex items-center justify-between gap-2", className)}
    >
      <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
        {label}
      </span>
      <span className="text-sm font-normal text-gray-900 dark:text-white text-right">
        {value}
      </span>
    </div>
  );
}

interface FlagBadgeProps {
  readonly label: string;
  readonly color: "red" | "orange" | "yellow" | "blue" | "green" | "gray";
  readonly icon?: React.ReactNode;
}

const flagColors = {
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

/**
 * A colored flag/tag badge
 */
export function FlagBadge({ label, color, icon }: FlagBadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        flagColors[color]
      )}
    >
      {icon}
      {label}
    </span>
  );
}
