"use client";

import { useMemo } from "react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { useDashletPgrest, DashletLoading, DashletError, parseResolvedNumber } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

export type GradientColor = "blue" | "green" | "red" | "yellow" | "purple";

export interface DashletConfig {
  title: string;
  value: string;
  unit: string;
  color: GradientColor;
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
}

export const defaultConfig: DashletConfig = {
  title: "Active Users",
  value: "2847",
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

  const fields = useMemo(
    () => ({
      title: config.title || "Active Users",
      value: String(config.value ?? "2847"),
      unit: config.unit ?? "",
    }),
    [config.title, config.value, config.unit],
  );

  const { resolved, loading, fetchError } = useDashletPgrest(config, fields);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Active Users";
  const unit = resolved.unit ?? "";
  const color = config.color || "blue";
  const value = parseResolvedNumber(resolved.value);

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
