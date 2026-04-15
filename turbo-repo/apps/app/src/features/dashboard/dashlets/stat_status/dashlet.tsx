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
import type { ValueColorRulesConfig } from "./value-color-rules";
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
  let ruleBorderColor: string | undefined;
  let ruleIconColor: string | undefined;
  let ruleTextColor: string | undefined;

  if (colorRulesConfig.rules.length > 0) {
    const evalValue = compiledValue;

    // Sort rules so most specific matches win
    const sortedRules = [...colorRulesConfig.rules].sort((a, b) => {
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

      if (isAGreater && isBGreater) return bVal - aVal;
      if (isALess && isBLess) return aVal - bVal;
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
        if (rule.targets.includes("border") && !ruleBorderColor) {
          ruleBorderColor = rule.color;
        }
        if (rule.targets.includes("icon") && !ruleIconColor) {
          ruleIconColor = rule.color;
        }
        if (rule.targets.includes("text") && !ruleTextColor) {
          ruleTextColor = rule.color;
        }
        if (ruleBorderColor && ruleIconColor && ruleTextColor) break;
      }
    }
  }

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  // Get effective colors: rule > (showColor ? base color : undefined)
  // If showColor is false, we use default theme colors (classes below)
  const baseColor = showColor ? color : undefined;
  const effectiveBorderColor = ruleBorderColor || baseColor;
  const effectiveIconColor = ruleIconColor || baseColor;
  const effectiveTextColor = ruleTextColor || baseColor;

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

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 border-l-4 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${!effectiveBorderColor ? DEFAULT_COLORS.border : ""}`}
      style={borderStyle}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {compiledTitle}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!effectiveIconColor ? DEFAULT_COLORS.iconBg : ""}`}
          style={iconBgStyle}
        >
          <IconComponent
            className={`h-4 w-4 ${!effectiveIconColor ? DEFAULT_COLORS.iconText : ""}`}
            style={iconTextStyle}
          />
        </div>
      </div>
      <div>
        <p
          className={`text-3xl font-bold ${!effectiveTextColor ? DEFAULT_COLORS.valueText : ""}`}
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
