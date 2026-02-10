"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: number;
  unit: string;
  color: "blue" | "green" | "red" | "yellow" | "purple";
}

export const defaultConfig: DashletConfig = {
  title: "Active Users",
  value: 2847,
  unit: "",
  color: "blue",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const COLORS = {
  blue: "from-blue-500 to-blue-600",
  green: "from-green-500 to-green-600",
  red: "from-red-500 to-red-600",
  yellow: "from-yellow-500 to-yellow-600",
  purple: "from-purple-500 to-purple-600",
};

// ============================================================================
// Component - Style 3: Gradient Bold
// ============================================================================

/**
 * Gradient Bold Card - Colored gradient background
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { title, value, unit, color } = config;

  return (
    <div
      className={`flex h-full flex-col justify-center rounded-lg bg-gradient-to-br ${COLORS[color]} p-4 text-white shadow-lg`}
    >
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-1 text-4xl font-bold">
        {value.toLocaleString()}
        {unit && <span className="ml-1 text-xl">{unit}</span>}
      </p>
    </div>
  );
}
