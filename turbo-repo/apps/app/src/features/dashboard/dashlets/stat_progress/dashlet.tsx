"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import {
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common/dashlet-states";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useRowThreshold } from "../common/use-threshold";
import {
  getThresholdBarClass,
  getThresholdTextClasses,
} from "../common/threshold-engine";
import type { ThresholdConfig } from "../common/threshold-types";
import { evaluateRule } from "../common/color-rule-engine";
import type { BarColorRulesConfig } from "./value-color-rules";
import { normalizeBarColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  target: string;
  unit: string;
  thresholds?: ThresholdConfig;
  /** Bar color rules */
  barColorRules?: BarColorRulesConfig;
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

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Quarterly Goal",
  value: "78",
  target: "100",
  unit: "%",
};

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
 * Evaluate bar color rules and return the matching color
 */
function evaluateBarColorRules(
  config: DashletConfig,
  value: number
): string | null {
  const normalized = normalizeBarColorRulesConfig(config.barColorRules);
  if (normalized.rules.length === 0) return null;

  for (const rule of normalized.rules) {
    if (
      evaluateRule(
        {
          column: "",
          operator: rule.operator,
          value: rule.value,
          color: rule.color,
        },
        String(value)
      )
    ) {
      return rule.color;
    }
  }
  return null;
}

/**
 * Progress Bar Card - Horizontal progress with milestones
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  const { color: thresholdColor, appliesTo } = useRowThreshold(
    config.thresholds,
    firstRow
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Quarterly Goal";
  const unit = resolved.unit ?? "%";
  const value = parseResolvedNumber(resolved.value);
  const target = parseResolvedNumber(resolved.target, 100);

  const percentage =
    target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;

  // Priority: barColorRules > thresholds > default
  const ruleColor = evaluateBarColorRules(config, value);
  let barColor: string;
  if (ruleColor) {
    barColor = `bg-[#${ruleColor}]`;
  } else if (thresholdColor && appliesTo("background")) {
    barColor = getThresholdBarClass(thresholdColor);
  } else {
    barColor = getBarColor(percentage);
  }

  return (
    <div className="flex h-full flex-col justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p
          className={`text-2xl font-bold ${thresholdColor && appliesTo("text") ? getThresholdTextClasses(thresholdColor) : "text-gray-900 dark:text-white"}`}
        >
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
          <span>{Math.round(target * 0.25)}</span>
          <span>{Math.round(target * 0.5)}</span>
          <span>{Math.round(target * 0.75)}</span>
          <span>{target}</span>
        </div>
      </div>
    </div>
  );
}
