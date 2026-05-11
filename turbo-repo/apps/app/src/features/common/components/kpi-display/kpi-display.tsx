"use client";

import { HiCheck, HiExclamation, HiClock, HiX, HiMinus } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { type LeadTimeData, getLeadTimeStatus } from "./kpi-display.types";
import { type I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface KpiRowProps {
  readonly label: string;
  readonly value: string;
  readonly status?: "success" | "warning" | "error" | "neutral";
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
  readonly label: string;
  readonly value: number; // 0-100
  readonly showPercentage?: boolean;
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

interface LeadTimeDisplayProps {
  readonly leadTime: LeadTimeData;
  /** If true, displays as a compact horizontal row instead of full card layout */
  readonly compact?: boolean;
  readonly dict: I18nRecord;
}

const leadTimeStatusColors = {
  success: "text-gray-700 dark:text-gray-300",
  warning: "text-gray-700 dark:text-gray-300",
  error: "text-yellow-500 dark:text-yellow-400",
  unknown: "text-gray-400 dark:text-gray-500",
};

const leadTimeBarColors = {
  success: "bg-gray-400",
  warning: "bg-gray-400",
  error: "bg-yellow-400 dark:bg-yellow-300",
  unknown: "bg-gray-200 dark:bg-gray-600",
};

/**
 * Display lead time compliance with cumplen/incumplen counts and percentage bar
 * Shows: total_lineasoc_cumplen, total_lineasoc_incumplen, and lineasoc_pctn_cumplimiento
 *
 * @param leadTime - The lead time data to display
 * @param compact - If true, displays as a compact horizontal row
 */
export function LeadTimeDisplay({ leadTime, compact, dict }: LeadTimeDisplayProps) {
  const status = getLeadTimeStatus(leadTime);
  const StatusIcon = {
    success: HiCheck,
    warning: HiExclamation,
    error: HiX,
    unknown: HiMinus,
  }[status];

  const pctLabel =
    leadTime.lineasoc_pctn_cumplimiento == null
      ? "—"
      : `${leadTime.lineasoc_pctn_cumplimiento}%`;
  const barWidth =
    leadTime.lineasoc_pctn_cumplimiento == null
      ? "0%"
      : `${leadTime.lineasoc_pctn_cumplimiento}%`;

  const totalLines =
    leadTime.total_lineasoc_cumplen + leadTime.total_lineasoc_incumplen;

  if (compact) {
    return (
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        {/* Column 1: Label with OC count */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
            Lead Time
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({tr("pages.planning.sidebar.form.leadTimeLocCount", dict, { count: String(totalLines) })})
          </span>
        </div>
        {/* Column 2: Progress bar + percentage + metadata */}
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={twMerge(
                "h-full rounded-full transition-all",
                leadTimeBarColors[status]
              )}
              style={{ width: barWidth }}
            />
          </div>
          {/* Percentage */}
          <span
            className={twMerge(
              "text-xs font-medium w-8 text-right",
              leadTimeStatusColors[status]
            )}
          >
            {pctLabel}
          </span>
          {/* Source breakdown: cumplen/incumplen */}
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[100px]">
            (<HiCheck className="w-3 h-3 inline" />
            {leadTime.total_lineasoc_cumplen} /{" "}
            <HiX className="w-3 h-3 inline text-yellow-600 dark:text-yellow-400" />
            {leadTime.total_lineasoc_incumplen})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header with title and overall status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-light">
            Lead Time
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({tr("pages.planning.sidebar.form.leadTimeLocLines", dict, { count: String(totalLines) })})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon
            className={twMerge(
              "w-4 h-4 shrink-0",
              leadTimeStatusColors[status]
            )}
          />
          <span
            className={twMerge(
              "text-sm font-semibold",
              leadTimeStatusColors[status]
            )}
          >
            {pctLabel}
          </span>
        </div>
      </div>

      {/* Detailed breakdown with labels */}
      <div className="grid grid-cols-2 gap-2">
        {/* Cumplen card */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/20 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center justify-center w-5 h-5 bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-full">
            <HiCheck className="w-3 h-3 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
              Cumplen
            </span>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {leadTime.total_lineasoc_cumplen}
            </span>
          </div>
        </div>

        {/* Incumplen card */}
        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center justify-center w-5 h-5 border border-yellow-300 dark:border-yellow-700 bg-yellow-100 dark:bg-yellow-800/50 rounded-full">
            <HiX className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
              Incumplen
            </span>
            <span className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
              {leadTime.total_lineasoc_incumplen}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={twMerge(
              "h-full rounded-full transition-all",
              leadTimeBarColors[status]
            )}
            style={{ width: barWidth }}
          />
        </div>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 w-8 text-right tabular-nums">
          {leadTime.total_lineasoc_cumplen}/{totalLines}
        </span>
      </div>
    </div>
  );
}
