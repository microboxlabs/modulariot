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
  backgroundColor: CardBackgroundColor;
  icon: CardIcon;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  name: "Metric",
  value: "0",
  backgroundColor: "white",
  icon: "chart",
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 2,
  minH: 1,
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
  white: "text-gray-500 dark:text-gray-400",
  gray: "text-gray-600 dark:text-gray-300",
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  red: "text-red-600 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
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
export function Dashlet({ widget }: DashletComponentProps) {
  const config = widget.config as unknown as DashletConfig;
  const name = config.name || "Metric";
  const value = config.value || "0";
  const bgColor = config.backgroundColor || "white";
  const iconType = config.icon || "chart";

  const Icon = ICONS[iconType];
  const bgClass = BG_COLORS[bgColor];
  const iconClass = ICON_COLORS[bgColor];

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 p-2 dark:border-gray-700 ${bgClass}`}
    >
      <div className="flex w-full flex-row gap-2">
        <Icon className={`h-5 w-5 ${iconClass}`} />
        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
          {name}
        </p>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
