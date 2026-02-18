"use client";

import { useMemo } from "react";
import Handlebars from "handlebars";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
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

export type StatusColor = "red" | "orange" | "green" | "blue" | "gray";

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

const ICONS: Record<StatusIcon, React.ComponentType<{ className?: string }>> =
  Object.fromEntries(
    ICON_OPTIONS.map((o) => [o.id, o.component])
  ) as Record<StatusIcon, React.ComponentType<{ className?: string }>>;

export interface ColorOption {
  id: StatusColor;
  label: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "gray", label: "Gray" },
];

export interface DataProviderEntry {
  key: string;
  value: string;
  _id?: number;
}

export interface DashletConfig {
  title: string;
  value: string;
  subtitle?: string;
  color: StatusColor;
  icon: StatusIcon;
  dataProvider?: DataProviderEntry[];
}

export const defaultConfig: DashletConfig = {
  title: "Status",
  value: "0",
  subtitle: "",
  color: "gray",
  icon: "check",
  dataProvider: [],
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Color Map
// ============================================================================

const COLOR_MAP: Record<
  StatusColor,
  { border: string; iconBg: string; iconText: string; valueText: string }
> = {
  red: {
    border: "border-l-red-500",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconText: "text-red-600 dark:text-red-400",
    valueText: "text-red-600 dark:text-red-400",
  },
  orange: {
    border: "border-l-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconText: "text-orange-600 dark:text-orange-400",
    valueText: "text-orange-600 dark:text-orange-400",
  },
  green: {
    border: "border-l-green-500",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconText: "text-green-600 dark:text-green-400",
    valueText: "text-green-600 dark:text-green-400",
  },
  blue: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "text-blue-600 dark:text-blue-400",
    valueText: "text-blue-600 dark:text-blue-400",
  },
  gray: {
    border: "border-l-gray-400",
    iconBg: "bg-gray-100 dark:bg-gray-700",
    iconText: "text-gray-600 dark:text-gray-400",
    valueText: "text-gray-900 dark:text-white",
  },
};

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    title = defaultConfig.title,
    value = defaultConfig.value,
    subtitle = "",
    color = defaultConfig.color,
    icon = defaultConfig.icon,
    dataProvider = [],
  } = config;

  const templateContext = useMemo(() => {
    const data_provider: Record<string, string> = {};
    for (const entry of dataProvider) {
      if (entry.key) data_provider[entry.key] = entry.value;
    }
    return { data_provider };
  }, [dataProvider]);

  const compiledTitle = useMemo(() => {
    try { return Handlebars.compile(title)(templateContext); } catch { return title; }
  }, [title, templateContext]);

  const compiledValue = useMemo(() => {
    try { return Handlebars.compile(value)(templateContext); } catch { return value; }
  }, [value, templateContext]);

  const compiledSubtitle = useMemo(() => {
    if (!subtitle) return "";
    try { return Handlebars.compile(subtitle)(templateContext); } catch { return subtitle; }
  }, [subtitle, templateContext]);

  const colors = COLOR_MAP[color] ?? COLOR_MAP.gray;
  const IconComponent = ICONS[icon] ?? ICONS.check;

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 border-l-4 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${colors.border}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {compiledTitle}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.iconBg}`}
        >
          <IconComponent className={`h-4 w-4 ${colors.iconText}`} />
        </div>
      </div>
      <div>
        <p className={`text-3xl font-bold ${colors.valueText}`}>{compiledValue}</p>
        {compiledSubtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {compiledSubtitle}
          </p>
        )}
      </div>
    </div>
  );
}
