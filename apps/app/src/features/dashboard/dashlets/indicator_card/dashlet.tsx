"use client";

import useSWR from "swr";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

/** Available threshold colors */
export type ThresholdColor = "green" | "yellow" | "red" | "blue" | "gray";

/** Color threshold range definition */
export interface ColorThreshold {
  min: number;
  max: number;
  color: ThresholdColor;
}

/** Configuration for this dashlet */
export interface DashletConfig {
  title: string;
  description: string;
  apiUrl: string;
  valueKey: string;
  unit: string;
  thresholds: ColorThreshold[];
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Indicator",
  description: "Configure this indicator in settings",
  apiUrl: "",
  valueKey: "value",
  unit: "%",
  thresholds: [
    { min: 0, max: 25, color: "red" },
    { min: 25, max: 75, color: "yellow" },
    { min: 75, max: 100, color: "green" },
  ],
};

// ============================================================================
// Layout Defaults
// ============================================================================

/** Grid layout constraints - larger than typical cards */
export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Background color Tailwind classes by threshold color */
const BG_COLORS: Record<ThresholdColor, string> = {
  green: "bg-green-50 dark:bg-green-900/30",
  yellow: "bg-yellow-50 dark:bg-yellow-900/30",
  red: "bg-red-50 dark:bg-red-900/30",
  blue: "bg-blue-50 dark:bg-blue-900/30",
  gray: "bg-gray-100 dark:bg-gray-700",
};

/** Text color Tailwind classes by threshold color */
const TEXT_COLORS: Record<ThresholdColor, string> = {
  green: "text-green-700 dark:text-green-300",
  yellow: "text-yellow-700 dark:text-yellow-300",
  red: "text-red-700 dark:text-red-300",
  blue: "text-blue-700 dark:text-blue-300",
  gray: "text-gray-700 dark:text-gray-300",
};

/** Default background when no threshold matches */
const DEFAULT_BG = "bg-white dark:bg-gray-800";
const DEFAULT_TEXT = "text-gray-900 dark:text-white";

/**
 * Extract a value from an object using dot notation
 * e.g., getNestedValue({ data: { value: 42 } }, "data.value") => 42
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Determine which threshold color applies to the given value
 */
function getThresholdColor(
  value: number,
  thresholds: ColorThreshold[]
): ThresholdColor | null {
  for (const threshold of thresholds) {
    if (value >= threshold.min && value <= threshold.max) {
      return threshold.color;
    }
  }
  return null;
}

/** Simple fetcher for SWR */
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ============================================================================
// Component
// ============================================================================

/**
 * Indicator Card Dashlet
 *
 * Displays a value fetched from an API with configurable color thresholds.
 * Shows title, large value with unit, and description.
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    title = "Indicator",
    description = "",
    apiUrl = "",
    valueKey = "value",
    unit = "%",
    thresholds = [],
  } = config;

  // Fetch data from API if URL is configured
  const { data, error, isLoading } = useSWR(
    apiUrl ? apiUrl : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
    }
  );

  // Extract the value from the response
  const rawValue = apiUrl ? getNestedValue(data, valueKey) : null;
  const numericValue =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? parseFloat(rawValue)
        : null;

  // Determine the color based on thresholds
  const thresholdColor =
    numericValue !== null ? getThresholdColor(numericValue, thresholds) : null;
  const bgClass = thresholdColor ? BG_COLORS[thresholdColor] : DEFAULT_BG;
  const textClass = thresholdColor ? TEXT_COLORS[thresholdColor] : DEFAULT_TEXT;

  // Format the display value
  const displayValue =
    numericValue !== null ? numericValue.toLocaleString() : "--";

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 p-4 dark:border-gray-700 ${bgClass} transition-colors duration-300`}
    >
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {title}
      </h3>

      {/* Value section */}
      <div className="flex flex-1 items-center justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
            <span className="text-gray-500 dark:text-gray-400">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 dark:text-red-400">Error loading data</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Check API URL in settings
            </p>
          </div>
        ) : !apiUrl ? (
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">No API configured</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Set API URL in settings
            </p>
          </div>
        ) : (
          <p className={`text-5xl font-bold ${textClass}`}>
            {displayValue}
            <span className="ml-1 text-2xl font-normal">{unit}</span>
          </p>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}
