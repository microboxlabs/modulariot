"use client";

import { HiArrowTrendingUp } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import {
  useDashletPgrest,
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { evaluateRule } from "../common/color-rule-engine";
import type { ValueColorRulesConfig } from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  previousValue: string;
  unit: string;
  description: string;
  target: string;
  /** Value-based color rules for text, bar, and badge */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Monthly Revenue",
  value: "84500",
  previousValue: "72000",
  unit: "$",
  description: "Total monthly revenue across all products",
  target: "100000",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Monthly Revenue",
  value: "84500",
  previousValue: "72000",
  unit: "$",
  description: "Total monthly revenue across all products",
  target: "100000",
};

// ============================================================================
// Component - Style 2: Full Details Card
// ============================================================================

/**
 * Full Details Card - Shows everything at once
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Monthly Revenue";
  const unit = resolved.unit ?? "$";
  const description = resolved.description || "";
  const valueColor = config.valueColor;

  const value = parseResolvedNumber(resolved.value);
  const previousValue = parseResolvedNumber(resolved.previousValue);
  const target = parseResolvedNumber(resolved.target);

  const change = value - previousValue;
  const changePercent =
    previousValue === 0
      ? 0
      : Number(((change / previousValue) * 100).toFixed(1));
  const progressPercent =
    target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
  const isPositive = change >= 0;

  // Evaluate value color rules
  const valueColorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );
  let ruleTextColor: string | undefined;
  let ruleBarColor: string | undefined;
  let ruleBadgeColor: string | undefined;

  // Field values map for field comparison mode
  const fieldValues: Record<string, number> = {
    previousValue,
    target,
  };

  if (valueColorRulesConfig.rules.length > 0) {
    const evalValue = String(value);

    // Helper to get comparison value based on rule's compare mode
    const getCompareValue = (
      rule: (typeof valueColorRulesConfig.rules)[0]
    ): string => {
      if (rule.compareMode === "field" && rule.compareField) {
        return String(fieldValues[rule.compareField] ?? 0);
      }
      return rule.value;
    };

    // Sort rules so most specific matches win
    const sortedRules = [...valueColorRulesConfig.rules].sort((a, b) => {
      const aVal = Number(getCompareValue(a)) || 0;
      const bVal = Number(getCompareValue(b)) || 0;
      const isAGreater =
        a.operator === "greater_than" || a.operator === "greater_than_or_equal";
      const isBGreater =
        b.operator === "greater_than" || b.operator === "greater_than_or_equal";
      const isALess =
        a.operator === "less_than" || a.operator === "less_than_or_equal";
      const isBLess =
        b.operator === "less_than" || b.operator === "less_than_or_equal";

      if (isAGreater && isBGreater) return bVal - aVal;
      if (isALess && isBLess) return aVal - bVal;
      return 0;
    });

    for (const rule of sortedRules) {
      const compareValue = getCompareValue(rule);
      if (
        evaluateRule(
          {
            column: "",
            operator: rule.operator,
            value: compareValue,
            color: "blue",
          },
          evalValue
        )
      ) {
        if (rule.targets.includes("text") && !ruleTextColor) {
          ruleTextColor = rule.color;
        }
        if (rule.targets.includes("bar") && !ruleBarColor) {
          ruleBarColor = rule.color;
        }
        if (rule.targets.includes("badge") && !ruleBadgeColor) {
          ruleBadgeColor = rule.color;
        }
        if (ruleTextColor && ruleBarColor && ruleBadgeColor) break;
      }
    }
  }

  // Build badge style and classes
  const badgeStyle = ruleBadgeColor
    ? { backgroundColor: `#${ruleBadgeColor}20`, color: `#${ruleBadgeColor}` }
    : undefined;
  const badgeClasses = ruleBadgeColor
    ? ""
    : isPositive
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  // Build text style
  const textStyle = ruleTextColor ? { color: `#${ruleTextColor}` } : undefined;
  const textClasses = ruleTextColor ? "" : "text-gray-900 dark:text-white";

  // Build bar style
  const barStyle = ruleBarColor
    ? { backgroundColor: `#${ruleBarColor}` }
    : undefined;
  const barClasses = ruleBarColor ? "" : "bg-blue-500";

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p
            className={`mt-1 text-3xl font-bold ${textClasses}`}
            style={textStyle}
          >
            {unit}
            {value.toLocaleString()}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${badgeClasses}`}
          style={badgeStyle}
        >
          <HiArrowTrendingUp
            className={`h-3 w-3 ${!isPositive && "rotate-180"}`}
          />
          {isPositive ? "+" : ""}
          {changePercent}%
        </div>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>

      {/* Progress to Target */}
      <div className="mt-auto pt-3">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Progress to target</span>
          <span>
            {unit}
            {target.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${barClasses} transition-all`}
            style={{ width: `${progressPercent}%`, ...barStyle }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {progressPercent.toFixed(0)}% of target reached
        </p>
      </div>

      {/* Comparison */}
      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-700">
        <span className="text-gray-500 dark:text-gray-400">
          Previous period
        </span>
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {unit}
          {previousValue.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
