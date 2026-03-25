"use client";

import type { ComponentType } from "react";
import {
  HiChartBar,
  HiCurrencyDollar,
  HiUsers,
  HiShoppingCart,
  HiClock,
  HiCheckCircle,
} from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

/** Available color themes */
export type ColorTheme =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "teal"
  | "orange";

/** Available icons */
export type IconType =
  | "chart"
  | "currency"
  | "users"
  | "cart"
  | "clock"
  | "check";

/** Configuration for this dashlet */
export interface DashletConfig {
  name: string;
  value: string;
  color: ColorTheme;
  icon: IconType;
  dataMode: "static" | "pgrest" | "planner";
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  plannerVariableName?: string;
  dataSourceId?: string;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  name: "Metric",
  value: "0",
  color: "gray",
  icon: "chart",
  dataMode: "static",
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 1,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Color theme configuration with bg, text, and icon colors */
interface ThemeColors {
  bg: string;
  text: string;
  icon: string;
  iconBg: string;
  dotClass: string;
}

/** All color themes with their Tailwind classes */
export const COLOR_THEMES: Record<ColorTheme, ThemeColors> = {
  gray: {
    bg: "bg-gray-50 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    icon: "text-gray-600 dark:text-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-700",
    dotClass: "bg-gray-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/10",
    text: "text-blue-700 dark:text-blue-200",
    icon: "text-blue-600 dark:text-blue-200",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    dotClass: "bg-blue-500",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/10",
    text: "text-green-700 dark:text-green-200",
    icon: "text-green-600 dark:text-green-200",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    dotClass: "bg-green-500",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/10",
    text: "text-yellow-700 dark:text-yellow-200",
    icon: "text-yellow-600 dark:text-yellow-200",
    iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
    dotClass: "bg-yellow-500",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/10",
    text: "text-red-700 dark:text-red-200",
    icon: "text-red-600 dark:text-red-200",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    dotClass: "bg-red-500",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/10",
    text: "text-purple-700 dark:text-purple-200",
    icon: "text-purple-600 dark:text-purple-200",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    dotClass: "bg-purple-500",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-900/10",
    text: "text-teal-700 dark:text-teal-200",
    icon: "text-teal-600 dark:text-teal-200",
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    dotClass: "bg-teal-500",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/10",
    text: "text-orange-700 dark:text-orange-200",
    icon: "text-orange-600 dark:text-orange-200",
    iconBg: "bg-orange-100 dark:bg-orange-900/50",
    dotClass: "bg-orange-500",
  },
};

/** Icon components map */
const ICONS: Record<IconType, ComponentType<{ className?: string }>> = {
  chart: HiChartBar,
  currency: HiCurrencyDollar,
  users: HiUsers,
  cart: HiShoppingCart,
  clock: HiClock,
  check: HiCheckCircle,
};

// ============================================================================
// Component
// ============================================================================

/**
 * Labeled Data Dashlet
 * Displays a key metric with icon, label, and large value
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const colorTheme = config.color || "gray";
  const iconType = config.icon || "chart";

  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: config.dataMode || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || [],
    plannerVariableName: config.plannerVariableName,
    fields: {
      name: config.name || "Metric",
      value: config.value || "0",
    },
    dataSourceId: config.dataSourceId,
  });

  const Icon = ICONS[iconType];
  const theme = COLOR_THEMES[colorTheme];

  return (
    <div
      className={`flex h-full flex-row items-center justify-between rounded-lg border border-gray-200 p-2 dark:border-gray-700 gap-2 ${theme.bg}`}
    >
      <div className="flex flex-row items-center gap-2">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center ${theme.iconBg}`}
        >
          <Icon className={`h-6 w-6 ${theme.icon}`} />
        </div>
        <p className={`text-md font-medium ${theme.text}`}>{resolved.name}</p>
      </div>
      {loading && (
        <div className="flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
        </div>
      )}
      {!loading && fetchError && (
        <p className="text-sm text-red-500 dark:text-red-400">{fetchError}</p>
      )}
      {!loading && !fetchError && (
        <div className={`text-lg font-semibold ${theme.text}`}>
          {resolved.value}
        </div>
      )}
    </div>
  );
}
