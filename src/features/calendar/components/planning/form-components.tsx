"use client";

import { HiCheck, HiExclamation, HiClock } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
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
  label: string;
  value: React.ReactNode;
  className?: string;
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
  label: string;
  color: "red" | "orange" | "yellow" | "blue" | "green" | "gray";
  icon?: React.ReactNode;
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

interface KpiRowProps {
  label: string;
  value: string;
  status?: "success" | "warning" | "error" | "neutral";
  statusLabel?: string;
}

const statusConfig = {
  success: {
    color: "text-gray-600 dark:text-gray-400",
    icon: HiCheck,
  },
  warning: {
    color: "text-gray-600 dark:text-gray-400",
    icon: HiExclamation,
  },
  error: {
    color: "text-yellow-400 dark:text-yellow-300",
    icon: HiClock,
  },
  neutral: {
    color: "text-gray-500 dark:text-gray-400",
    icon: null,
  },
};

/**
 * A KPI display row with optional status indicator
 */
export function KpiRow({ label, value, status }: KpiRowProps) {
  const config = status ? statusConfig[status] : null;
  const StatusIcon = config?.icon;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {StatusIcon && (
          <StatusIcon className={twMerge("w-4 h-4", config?.color)} />
        )}
        <span
          className={twMerge(
            "text-sm font-normal",
            config?.color || "text-gray-900 dark:text-white"
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number; // 0-100
  showPercentage?: boolean;
}

/**
 * Get occupancy color based on percentage
 */
function getOccupancyColor(percentage: number): string {
  if (percentage >= 100) return "bg-yellow-400 dark:bg-yellow-300";
  return "bg-gray-400";
}

/**
 * A simple progress bar with label
 */
export function ProgressBar({
  label,
  value,
  showPercentage = true,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 font-light">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 max-w-[120px]">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getOccupancyColor(clampedValue)}`}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
        {showPercentage && (
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
            {clampedValue}%
          </span>
        )}
      </div>
    </div>
  );
}
