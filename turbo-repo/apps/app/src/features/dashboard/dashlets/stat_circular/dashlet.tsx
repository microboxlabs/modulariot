"use client";

import { useMemo } from "react";
import type { DashletComponentProps, DashletLayoutDefaults, DataProviderEntry } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import { useHybridPgrestContext } from "../common/use-dashlet-pgrest";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useThreshold } from "../common/use-threshold";
import { getThresholdStrokeClass, getThresholdTextClasses } from "../common/threshold-engine";
import type { ThresholdConfig } from "../common/threshold-types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  maxValue: string;
  unit: string;
  dataMode: "static" | "pgrest" | "planner";
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
  plannerVariableName?: string;
  dataProvider?: DataProviderEntry[];
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Storage Used",
  value: "67",
  maxValue: "100",
  unit: "GB",
  dataMode: "static",
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  dataProvider: [],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 5: Circular Progress
// ============================================================================

/**
 * Get stroke color based on percentage
 */
function getStrokeColor(percentage: number): string {
  if (percentage < 50) return "stroke-green-500";
  if (percentage < 80) return "stroke-yellow-500";
  return "stroke-red-500";
}

const EMPTY_DATA_PROVIDER: DataProviderEntry[] = [];

/**
 * Circular Progress Card - Donut chart style
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { dataProvider = EMPTY_DATA_PROVIDER } = config;

  // Coerce to string for backwards compatibility with old numeric configs
  const title = String(config.title ?? defaultConfig.title);
  const value = String(config.value ?? defaultConfig.value);
  const maxValue = String(config.maxValue ?? defaultConfig.maxValue);
  const unit = String(config.unit ?? defaultConfig.unit);

  // ── Data fetching (supports static, pgrest, and planner) ─────────────────
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const { templateContext, loading, fetchError } = useHybridPgrestContext(
    config,
    dataProvider,
    refreshIntervalMs,
  );

  // ── Resolve handlebars templates ──────────────────────────────────────────
  const compiledTitle = useMemo(() => resolveHandlebarsField(title, templateContext), [title, templateContext]);
  const compiledValue = useMemo(() => resolveHandlebarsField(value, templateContext), [value, templateContext]);
  const compiledMaxValue = useMemo(() => resolveHandlebarsField(maxValue, templateContext), [maxValue, templateContext]);
  const compiledUnit = useMemo(() => resolveHandlebarsField(unit, templateContext), [unit, templateContext]);

  const { color: thresholdColor, appliesTo } = useThreshold(config.thresholds, templateContext);

  const numericValue = Number(compiledValue) || 0;
  const numericMaxValue = Number(compiledMaxValue) || 0;

  const rawPercentage = numericMaxValue > 0 ? (numericValue / numericMaxValue) * 100 : 0;
  const percentage = Math.min(100, Math.max(0, rawPercentage));
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const color = thresholdColor && appliesTo("background") ? getThresholdStrokeClass(thresholdColor) : getStrokeColor(percentage);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-red-500 dark:text-red-400">Error: {fetchError}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        {compiledTitle}
      </p>

      {/* Circular gauge */}
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${color} transition-all duration-500`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold ${thresholdColor && appliesTo("text") ? getThresholdTextClasses(thresholdColor) : "text-gray-900 dark:text-white"}`}>
            {compiledValue}
          </span>
          <span className="text-xs text-gray-500">{compiledUnit}</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        of {compiledMaxValue} {compiledUnit}
      </p>
    </div>
  );
}
