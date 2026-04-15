"use client";

import { useMemo } from "react";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
  DataProviderEntry,
} from "../types";
import type { PgrestDashletFields } from "../common";
import {
  useHybridPgrestContext,
  DashletLoading,
  DashletError,
} from "../common";
import { evaluateRule } from "../common/color-rule-engine";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import type {
  ValueColorRulesConfig,
  ValueColorRule,
} from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";
import {
  HiWrench,
  HiCalendarDays,
  HiSignal,
  HiCheckCircle,
  HiExclamationTriangle,
  HiTruck,
  HiChartBar,
  HiUsers,
  HiBolt,
  HiClock,
  HiWifi,
  HiCircleStack,
  HiArrowTrendingUp,
} from "react-icons/hi2";

// ============================================================================
// Configuration Types
// ============================================================================

export type StatusIcon =
  | "wrench"
  | "calendar"
  | "signal"
  | "check"
  | "warning"
  | "truck"
  | "chart"
  | "users"
  | "bolt"
  | "clock"
  | "wifi"
  | "database"
  | "trending";

export interface IconOption {
  id: StatusIcon;
  label: string;
  component: React.ComponentType<{ className?: string }>;
}

export const ICON_OPTIONS: IconOption[] = [
  { id: "wrench", label: "Wrench", component: HiWrench },
  { id: "calendar", label: "Calendar", component: HiCalendarDays },
  { id: "signal", label: "Signal", component: HiSignal },
  { id: "check", label: "Check", component: HiCheckCircle },
  { id: "warning", label: "Warning", component: HiExclamationTriangle },
  { id: "truck", label: "Truck", component: HiTruck },
  { id: "chart", label: "Chart", component: HiChartBar },
  { id: "users", label: "Users", component: HiUsers },
  { id: "bolt", label: "Bolt", component: HiBolt },
  { id: "clock", label: "Clock", component: HiClock },
  { id: "wifi", label: "Wifi", component: HiWifi },
  { id: "database", label: "Database", component: HiCircleStack },
  { id: "trending", label: "Trending Up", component: HiArrowTrendingUp },
];

const ICONS: Record<
  StatusIcon,
  React.ComponentType<{ className?: string }>
> = Object.fromEntries(ICON_OPTIONS.map((o) => [o.id, o.component])) as Record<
  StatusIcon,
  React.ComponentType<{ className?: string }>
>;

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  subtitle?: string;
  /** Whether to use custom color or default theme colors */
  showColor?: boolean;
  /** Hex color without # (e.g. "3b82f6") */
  color?: string;
  icon: StatusIcon;
  dataProvider?: DataProviderEntry[];
  /** Color rules for value-based styling */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Status",
  value: "0",
  subtitle: "",
  showColor: false,
  color: "3b82f6",
  icon: "check",
  dataProvider: [],
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Default Color (gray fallback)
// ============================================================================

const DEFAULT_COLORS = {
  border: "border-l-gray-400",
  iconBg: "bg-gray-100 dark:bg-gray-700",
  iconText: "text-gray-600 dark:text-gray-400",
  valueText: "text-gray-900 dark:text-white",
};

const EMPTY_DATA_PROVIDER: DataProviderEntry[] = [];

// ============================================================================
// Color Rules Helpers
// ============================================================================

interface EvaluatedColors {
  borderColor: string | undefined;
  iconColor: string | undefined;
  textColor: string | undefined;
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
  let borderColor: string | undefined;
  let iconColor: string | undefined;
  let textColor: string | undefined;

  const sortedRules = sortColorRules(rules);

  for (const rule of sortedRules) {
    const matches = evaluateRule(
      { column: "", operator: rule.operator, value: rule.value, color: "blue" },
      evalValue
    );
    if (!matches) continue;

    if (rule.targets.includes("border") && !borderColor)
      borderColor = rule.color;
    if (rule.targets.includes("icon") && !iconColor) iconColor = rule.color;
    if (rule.targets.includes("text") && !textColor) textColor = rule.color;
    if (borderColor && iconColor && textColor) break;
  }

  return { borderColor, iconColor, textColor };
}

/** Get border classes when no custom color is applied */
function getBorderClasses(effectiveColor: string | undefined): string {
  if (effectiveColor) return "";
  return DEFAULT_COLORS.border;
}

/** Get icon background classes when no custom color is applied */
function getIconBgClasses(effectiveColor: string | undefined): string {
  if (effectiveColor) return "";
  return DEFAULT_COLORS.iconBg;
}

/** Get icon text classes when no custom color is applied */
function getIconTextClasses(effectiveColor: string | undefined): string {
  if (effectiveColor) return "";
  return DEFAULT_COLORS.iconText;
}

/** Get value text classes when no custom color is applied */
function getValueTextClasses(effectiveColor: string | undefined): string {
  if (effectiveColor) return "";
  return DEFAULT_COLORS.valueText;
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    title = defaultConfig.title,
    value = defaultConfig.value,
    subtitle = "",
    showColor = false,
    color = "3b82f6",
    icon = defaultConfig.icon,
    dataProvider = EMPTY_DATA_PROVIDER,
  } = config;

  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { templateContext, loading, fetchError } = useHybridPgrestContext(
    config,
    dataProvider,
    refreshIntervalMs
  );

  const compiledTitle = useMemo(
    () => resolveHandlebarsField(title, templateContext),
    [title, templateContext]
  );
  const compiledValue = useMemo(
    () => resolveHandlebarsField(value, templateContext),
    [value, templateContext]
  );
  const compiledSubtitle = useMemo(() => {
    if (!subtitle) return "";
    return resolveHandlebarsField(subtitle, templateContext);
  }, [subtitle, templateContext]);

  // Evaluate color rules
  const colorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  const {
    borderColor: ruleBorderColor,
    iconColor: ruleIconColor,
    textColor: ruleTextColor,
  } = colorRulesConfig.rules.length > 0
    ? evaluateColorRules(colorRulesConfig.rules, compiledValue)
    : { borderColor: undefined, iconColor: undefined, textColor: undefined };

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  // Get effective colors: rule > (showColor ? base color : undefined)
  // If showColor is false, we use default theme colors (classes below)
  const baseColor = showColor ? color : undefined;
  const effectiveBorderColor = ruleBorderColor ?? baseColor;
  const effectiveIconColor = ruleIconColor ?? baseColor;
  const effectiveTextColor = ruleTextColor ?? baseColor;

  const IconComponent = ICONS[icon] ?? ICONS.check;

  // Build styles for hex colors (only when we have a custom color)
  const borderStyle = effectiveBorderColor
    ? { borderLeftColor: `#${effectiveBorderColor}` }
    : undefined;
  const iconBgStyle = effectiveIconColor
    ? { backgroundColor: `#${effectiveIconColor}20` }
    : undefined;
  const iconTextStyle = effectiveIconColor
    ? { color: `#${effectiveIconColor}` }
    : undefined;
  const valueTextStyle = effectiveTextColor
    ? { color: `#${effectiveTextColor}` }
    : undefined;

  // Pre-compute classes using helpers (avoids negated conditions in JSX)
  const borderClasses = getBorderClasses(effectiveBorderColor);
  const iconBgClasses = getIconBgClasses(effectiveIconColor);
  const iconTextClasses = getIconTextClasses(effectiveIconColor);
  const valueTextClasses = getValueTextClasses(effectiveTextColor);

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 border-l-4 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${borderClasses}`}
      style={borderStyle}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {compiledTitle}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBgClasses} ${iconTextClasses}`}
          style={{ ...iconBgStyle, ...iconTextStyle }}
        >
          <IconComponent className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p
          className={`text-3xl font-bold ${valueTextClasses}`}
          style={valueTextStyle}
        >
          {compiledValue}
        </p>
        {compiledSubtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {compiledSubtitle}
          </p>
        )}
      </div>
    </div>
  );
}
