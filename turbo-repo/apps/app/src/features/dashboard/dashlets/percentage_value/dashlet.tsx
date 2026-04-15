"use client";

import { useMemo } from "react";
import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { evaluateRule } from "../common/color-rule-engine";
import type { ProgressBarColorConfig } from "./progress-bar-color-rules";
import { normalizeProgressBarColorConfig } from "./progress-bar-color-rules";

const EMPTY_PARAMS: PgrestParam[] = [];

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for this dashlet */
export interface DashletConfig {
  title: string;
  value: string;
  max: string;
  /** Progress bar color (hex without #) */
  barColor?: string;
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  plannerVariableName?: string;
  dataSourceId?: string;
  /** Bar color rules configuration */
  barColorRules?: ProgressBarColorConfig;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Progress",
  value: "6",
  max: "10",
  barColor: "2563eb",
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

  const fields = useMemo(
    () => ({
      title: config.title || "Progress",
      value: String(config.value ?? "6"),
      max: String(config.max ?? "10"),
    }),
    [config.title, config.value, config.max]
  );

  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: (config.dataMode as "static" | "pgrest" | "planner") || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || EMPTY_PARAMS,
    plannerVariableName: config.plannerVariableName,
    fields,
    dataSourceId: config.dataSourceId,
    refreshIntervalMs,
  });

  // ── Bar color rules evaluation ───
  const barColorRulesConfig = useMemo(
    () => normalizeProgressBarColorConfig(config.barColorRules),
    [config.barColorRules]
  );

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
        <span className="text-xs text-red-600 dark:text-red-400">
          {fetchError}
        </span>
      </div>
    );
  }

  const title = resolved.title || "Progress";
  const parsedValue =
    resolved.value === "" || resolved.value == null
      ? Number.NaN
      : Number(resolved.value);
  const parsedMax =
    resolved.max === "" || resolved.max == null
      ? Number.NaN
      : Number(resolved.max);
  const value = Number.isFinite(parsedValue) ? parsedValue : 0;
  const max = Number.isFinite(parsedMax) ? parsedMax : 10;

  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const defaultBarColor = config.barColor ?? "2563eb";

  // Evaluate bar color rules (based on percentage or count)
  let barColor = defaultBarColor;
  if (barColorRulesConfig.enabled && barColorRulesConfig.rules.length > 0) {
    const evalValue =
      barColorRulesConfig.evalMode === "percentage"
        ? String(percentage)
        : String(value);

    // Sort rules so most specific matches win:
    // - greater_than/greater_than_or_equal: check highest thresholds first
    // - less_than/less_than_or_equal: check lowest thresholds first
    const sortedRules = [...barColorRulesConfig.rules].sort((a, b) => {
      const aVal = Number(a.value) || 0;
      const bVal = Number(b.value) || 0;
      const isAGreater =
        a.operator === "greater_than" || a.operator === "greater_than_or_equal";
      const isBGreater =
        b.operator === "greater_than" || b.operator === "greater_than_or_equal";
      const isALess =
        a.operator === "less_than" || a.operator === "less_than_or_equal";
      const isBLess =
        b.operator === "less_than" || b.operator === "less_than_or_equal";

      // If both are "greater" type, sort descending (highest first)
      if (isAGreater && isBGreater) return bVal - aVal;
      // If both are "less" type, sort ascending (lowest first)
      if (isALess && isBLess) return aVal - bVal;
      // Mixed operators: keep original order
      return 0;
    });

    for (const rule of sortedRules) {
      if (
        evaluateRule(
          {
            column: "",
            operator: rule.operator,
            value: rule.value,
            color: "blue",
          },
          evalValue
        )
      ) {
        barColor = rule.color;
        break;
      }
    }
  }

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-2 px-4 dark:border-gray-700 dark:bg-gray-800"
      style={{ containerType: "size" }}
    >
      {/* Header with title and value */}
      <div className="flex shrink-0 items-center justify-between">
        <span
          className="font-medium text-gray-600 dark:text-gray-400"
          style={{ fontSize: "clamp(0.75rem, 15cqh, 2.5rem)" }}
        >
          {title}
        </span>
        <span
          className="font-semibold text-gray-900 dark:text-white"
          style={{ fontSize: "clamp(0.75rem, 15cqh, 2.5rem)" }}
        >
          {value} / {max}{" "}
          <span className="text-gray-500 dark:text-gray-400">
            ({clampedPercentage}%)
          </span>
        </span>
      </div>

      {/* Progress bar - fills remaining height */}
      <div className="mt-2 flex min-h-1.5 flex-1 w-full items-center">
        <div className="h-full w-full overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${clampedPercentage}%`,
              backgroundColor: `#${barColor}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
