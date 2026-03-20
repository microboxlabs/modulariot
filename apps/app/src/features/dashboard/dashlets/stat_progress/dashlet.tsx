"use client";

import { useMemo } from "react";
import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";

const EMPTY_PARAMS: PgrestParam[] = [];

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  target: string;
  unit: string;
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
}

export const defaultConfig: DashletConfig = {
  title: "Quarterly Goal",
  value: "78",
  target: "100",
  unit: "%",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 7: Progress Bar
// ============================================================================

/**
 * Get progress bar color based on percentage
 */
function getBarColor(percentage: number): string {
  if (percentage >= 75) return "bg-green-500";
  if (percentage >= 50) return "bg-blue-500";
  if (percentage >= 25) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * Progress Bar Card - Horizontal progress with milestones
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;

  const fields = useMemo(
    () => ({
      title: config.title || "Quarterly Goal",
      value: String(config.value ?? "78"),
      target: String(config.target ?? "100"),
      unit: config.unit ?? "%",
    }),
    [config.title, config.value, config.target, config.unit],
  );

  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: (config.dataMode as "static" | "pgrest") || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || EMPTY_PARAMS,
    fields,
    dataSourceId: config.dataSourceId,
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

  const title = resolved.title || "Quarterly Goal";
  const unit = resolved.unit ?? "%";
  const parsedValue = resolved.value === "" || resolved.value == null ? Number.NaN : Number(resolved.value);
  const parsedTarget = resolved.target === "" || resolved.target == null ? Number.NaN : Number(resolved.target);
  const value = Number.isFinite(parsedValue) ? parsedValue : 0;
  const target = Number.isFinite(parsedTarget) ? parsedTarget : 100;

  const percentage = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const barColor = getBarColor(percentage);

  return (
    <div className="flex h-full flex-col justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
          <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
          {/* Milestone markers */}
          <div className="absolute inset-0 flex justify-between px-0.5">
            {[25, 50, 75].map((mark) => (
              <div
                key={mark}
                className="h-full w-0.5 bg-white/50"
                style={{ marginLeft: `${mark}%` }}
              />
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>{target}</span>
        </div>
      </div>
    </div>
  );
}
