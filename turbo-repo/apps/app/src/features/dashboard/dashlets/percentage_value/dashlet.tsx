"use client";

import { useMemo } from "react";
import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import {
  type PgrestParam,
  type PgrestHttpMethod,
} from "../common/pgrest-types";
import { usePgrestResolvedFields } from "../common/use-pgrest-resolved-fields";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { evaluateRule } from "../common/color-rule-engine";
import { sortColorRules } from "../common/color-rule-evaluation";
import type { ColorRuleOperator } from "../common/color-rule-types";
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
// Color Rules Helpers
// ============================================================================

interface ProgressBarRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
}

function evaluateBarColor(
  rules: ProgressBarRule[],
  evalValue: string,
  defaultColor: string
): string {
  const sortedRules = sortColorRules(rules);
  for (const rule of sortedRules) {
    const matches = evaluateRule(
      { column: "", operator: rule.operator, value: rule.value, color: "blue" },
      evalValue
    );
    if (matches) return rule.color;
  }
  return defaultColor;
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

  // Determine evaluation value based on mode
  const evalValue =
    barColorRulesConfig.evalMode === "percentage"
      ? String(percentage)
      : String(value);

  // Evaluate bar color rules (based on percentage or count)
  const barColor =
    barColorRulesConfig.enabled && barColorRulesConfig.rules.length > 0
      ? evaluateBarColor(barColorRulesConfig.rules, evalValue, defaultBarColor)
      : defaultBarColor;

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
