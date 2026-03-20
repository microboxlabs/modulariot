"use client";

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

/** Available background colors for card */
export type CardBackgroundColor =
  | "white"
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";

/** Available icons for card */
export type CardIcon =
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
  descriptor: string;
  backgroundColor: CardBackgroundColor;
  icon: CardIcon;
  dataMode: "static" | "pgrest";
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  name: "Metric",
  value: "0",
  descriptor: "",
  backgroundColor: "white",
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
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Background color Tailwind classes */
const BG_COLORS: Record<CardBackgroundColor, string> = {
  white: "bg-white dark:bg-gray-800",
  gray: "bg-gray-100 dark:bg-gray-700",
  blue: "bg-blue-50 dark:bg-blue-900/30",
  green: "bg-green-50 dark:bg-green-900/30",
  yellow: "bg-yellow-50 dark:bg-yellow-900/30",
  red: "bg-red-50 dark:bg-red-900/30",
  purple: "bg-purple-50 dark:bg-purple-900/30",
};

/** Icon color Tailwind classes */
const ICON_COLORS: Record<CardBackgroundColor, string> = {
  white: "text-gray-700 dark:text-gray-200",
  gray: "text-gray-700 dark:text-gray-200",
  blue: "text-blue-700 dark:text-blue-200",
  green: "text-green-700 dark:text-green-200",
  yellow: "text-yellow-700 dark:text-yellow-200",
  red: "text-red-700 dark:text-red-200",
  purple: "text-purple-700 dark:text-purple-200",
};

/** Icon components map */
const ICONS: Record<CardIcon, React.ComponentType<{ className?: string }>> = {
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
 * Card Dashlet
 * Displays a key metric with icon, label, and large value
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const bgColor = config.backgroundColor || "white";
  const iconType = config.icon || "chart";

  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: config.dataMode || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || [],
    fields: {
      name: config.name || "Metric",
      value: config.value || "0",
      descriptor: config.descriptor || "",
    },
    dataSourceId: config.dataSourceId,
  });

  const { name, value, descriptor } = resolved;

  const Icon = ICONS[iconType];
  const bgClass = BG_COLORS[bgColor];
  const iconClass = ICON_COLORS[bgColor];

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 p-2 [container-type:size] dark:border-gray-700 ${bgClass}`}
    >
      <div className="flex w-full flex-row items-center gap-2 overflow-hidden">
        <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
        <p className="truncate text-[min(1.125rem,5cqw)] font-medium leading-tight text-gray-700 dark:text-gray-200">
          {name}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-start justify-center overflow-hidden [container-type:size]">
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
          </div>
        )}
        {!loading && fetchError && (
          <p className="text-sm text-red-500 dark:text-red-400">{fetchError}</p>
        )}
        {!loading && !fetchError && (
          <>
            <p className="w-full truncate text-[min(70cqh,18cqw)] font-bold leading-none text-gray-900 dark:text-white">
              {value}
            </p>
            {descriptor && (
              <p className="w-full truncate text-[min(0.875rem,4cqw)] text-gray-400 dark:text-gray-300">
                {descriptor}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
