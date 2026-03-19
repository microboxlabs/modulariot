"use client";

import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for this dashlet */
export interface DashletConfig {
  title: string;
  value: string;
  max: string;
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Progress",
  value: "6",
  max: "10",
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 1,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Percentage Value Dashlet
 * Displays a progress indicator with title, value/max, and progress bar
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;

  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: config.dataMode || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || [],
    fields: {
      title: config.title || "Progress",
      value: config.value ?? "6",
      max: config.max ?? "10",
    },
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <Spinner size="sm" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
        <span className="text-xs text-red-600 dark:text-red-400">{fetchError}</span>
      </div>
    );
  }

  const title = resolved.title || "Progress";
  const value = Number(resolved.value) || 0;
  const max = Number(resolved.max) || 10;

  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex h-full flex-col justify-center gap-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      {/* Header with title and value */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {value} / {max}{" "}
          <span className="text-gray-500 dark:text-gray-400">
            ({clampedPercentage}%)
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}
