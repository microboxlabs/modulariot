"use client";

import { useState } from "react";
import { HiChevronDown, HiChevronUp } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import { useDashletPgrest, DashletLoading, DashletError } from "../common";
import { evaluateRule } from "../common/color-rule-engine";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type {
  ValueColorRulesConfig,
  ValueColorRule,
} from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  details: { label: string; value: string }[];
  /** Custom color for the value text (hex without #) */
  valueColor?: string;
  /** Color rules for value-based styling */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Conversion Rate",
  value: "3.24",
  unit: "%",
  details: [
    { label: "Visitors", value: "12,847" },
    { label: "Conversions", value: "416" },
    { label: "Avg. Time", value: "2m 34s" },
    { label: "Bounce Rate", value: "42%" },
  ],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Conversion Rate",
  value: "3.24",
  unit: "%",
};

// ============================================================================
// Color Rules Helpers
// ============================================================================

interface EvaluatedColors {
  textColor: string | undefined;
  bgColor: string | undefined;
}

function isGreaterOperator(op: string): boolean {
  return op === "greater_than" || op === "greater_than_or_equal";
}

function isLessOperator(op: string): boolean {
  return op === "less_than" || op === "less_than_or_equal";
}

function sortColorRules(rules: ValueColorRule[]): ValueColorRule[] {
  return [...rules].sort((a, b) => {
    const aVal = Number(a.value) || 0;
    const bVal = Number(b.value) || 0;
    if (isGreaterOperator(a.operator) && isGreaterOperator(b.operator)) {
      return bVal - aVal;
    }
    if (isLessOperator(a.operator) && isLessOperator(b.operator)) {
      return aVal - bVal;
    }
    return 0;
  });
}

function evaluateColorRules(
  rules: ValueColorRule[],
  evalValue: string
): EvaluatedColors {
  let textColor: string | undefined;
  let bgColor: string | undefined;

  const sortedRules = sortColorRules(rules);

  for (const rule of sortedRules) {
    const matches = evaluateRule(
      { column: "", operator: rule.operator, value: rule.value, color: "blue" },
      evalValue
    );
    if (!matches) continue;

    if (rule.targets.includes("text") && !textColor) textColor = rule.color;
    if (rule.targets.includes("bg") && !bgColor) bgColor = rule.color;
    if (textColor && bgColor) break;
  }

  return { textColor, bgColor };
}

/** Determine value text style based on rule or manual color */
function getValueTextStyle(
  ruleTextColor: string | undefined,
  valueColor: string | undefined
): React.CSSProperties | undefined {
  if (ruleTextColor) return { color: `#${ruleTextColor}` };
  if (valueColor) return { color: `#${valueColor}` };
  return undefined;
}

/** Determine value text classes when no color override */
function getValueTextClasses(
  ruleTextColor: string | undefined,
  valueColor: string | undefined
): string {
  if (ruleTextColor || valueColor) return "";
  return "text-gray-900 dark:text-white";
}

// ============================================================================
// Component - Style 6: Expandable Details
// ============================================================================

/**
 * Expandable Card - Click to expand and show more details
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const details = config.details || defaultConfig.details;
  const [expanded, setExpanded] = useState(false);
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Conversion Rate";
  const unit = resolved.unit ?? "%";
  const valueColor = config.valueColor;
  const parsedValue =
    resolved.value === "" || resolved.value == null
      ? Number.NaN
      : Number(resolved.value);
  const displayValue = Number.isFinite(parsedValue)
    ? parsedValue
    : resolved.value;

  // Evaluate value color rules
  const colorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  const { textColor: ruleTextColor, bgColor: ruleBgColor } =
    colorRulesConfig.rules.length > 0
      ? evaluateColorRules(colorRulesConfig.rules, String(displayValue))
      : { textColor: undefined, bgColor: undefined };

  // Build background styles
  const mainBgStyle = ruleBgColor
    ? { backgroundColor: `#${ruleBgColor}20` }
    : undefined;
  const expandedBgStyle = ruleBgColor
    ? { backgroundColor: `#${ruleBgColor}10` }
    : undefined;

  // Build value text styling
  const valueTextStyle = getValueTextStyle(ruleTextColor, valueColor);
  const valueTextClasses = getValueTextClasses(ruleTextColor, valueColor);

  // Build container classes
  const containerBgClasses = ruleBgColor ? "" : "bg-white dark:bg-gray-800";
  const expandedBgClasses = ruleBgColor ? "" : "bg-gray-50 dark:bg-gray-900/50";
  const buttonClasses = ruleBgColor
    ? ""
    : "text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-700";

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 dark:border-gray-700 ${containerBgClasses}`}
      style={mainBgStyle}
    >
      {/* Main content */}
      <div className="flex flex-1 flex-col justify-center p-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p
          className={`mt-1 text-3xl font-bold ${valueTextClasses}`}
          style={valueTextStyle}
        >
          {displayValue}
          <span className="ml-1 text-lg font-normal text-gray-500">{unit}</span>
        </p>
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer flex items-center justify-center gap-1 border-t border-gray-200 py-2 text-xs dark:border-gray-700 ${buttonClasses}`}
        style={
          ruleBgColor
            ? {
                color: `#${ruleBgColor}`,
                ["--tw-bg-opacity" as string]: 1,
              }
            : undefined
        }
        onMouseEnter={(e) => {
          if (ruleBgColor) {
            e.currentTarget.style.backgroundColor = `#${ruleBgColor}30`;
          }
        }}
        onMouseLeave={(e) => {
          if (ruleBgColor) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        {expanded ? (
          <>
            Hide details <HiChevronUp className="h-4 w-4" />
          </>
        ) : (
          <>
            Show details <HiChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Expandable details */}
      {expanded && (
        <div
          className={`border-t border-gray-200 p-3 dark:border-gray-700 ${expandedBgClasses}`}
          style={expandedBgStyle}
        >
          <div className="grid grid-cols-2 gap-2">
            {details.map((detail) => (
              <div key={detail.label}>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {detail.label}
                </p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
