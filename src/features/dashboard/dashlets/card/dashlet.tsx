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
  const name = config.name || "Metric";
  const value = config.value || "0";
  const bgColor = config.backgroundColor || "white";
  const iconType = config.icon || "chart";

  const Icon = ICONS[iconType];
  const bgClass = BG_COLORS[bgColor];
  const iconClass = ICON_COLORS[bgColor];

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 p-2 [container-type:size] dark:border-gray-700 ${bgClass}`}
    >
      <div className="flex w-full flex-row gap-2">
        <Icon className={`h-5 w-5 ${iconClass}`} />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          {name}
        </p>
      </div>
      <div className="flex flex-col flex-1 items-start overflow-hidden [container-type:size]">
        <p className="text-[70cqh] font-bold leading-none text-gray-900 dark:text-white h-full">
          {value}
        </p>
        <p className="text-gray-300 text-sm">12.7Km recorridos</p>
      </div>
    </div>
  );
}
