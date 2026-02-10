"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: number;
  maxValue: number;
  unit: string;
}

export const defaultConfig: DashletConfig = {
  title: "Storage Used",
  value: 67,
  maxValue: 100,
  unit: "GB",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 5: Circular Progress
// ============================================================================

/**
 * Circular Progress Card - Donut chart style
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { title, value, maxValue, unit } = config;

  const percentage = (value / maxValue) * 100;
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const color =
    percentage < 50
      ? "stroke-green-500"
      : percentage < 80
        ? "stroke-yellow-500"
        : "stroke-red-500";

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>

      {/* Circular gauge */}
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${color} transition-all duration-500`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {value}
          </span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        of {maxValue} {unit}
      </p>
    </div>
  );
}
