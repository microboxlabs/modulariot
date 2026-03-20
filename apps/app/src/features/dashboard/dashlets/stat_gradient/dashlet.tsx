"use client";

import { useMemo } from "react";
import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";

const EMPTY_PARAMS: PgrestParam[] = [];

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

  const { resolved, loading, fetchError } = usePgrestResolvedFields({
    dataMode: (config.dataMode as "static" | "pgrest") || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || EMPTY_PARAMS,
    fields,
    dataSourceId: config.dataSourceId,
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <Spinner size="sm" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
        <span className="text-xs text-red-600 dark:text-red-400">{fetchError}</span>
      </div>
    );
  }

  const title = resolved.title || "Active Users";
  const unit = resolved.unit ?? "";
  const color = config.color || "blue";
  const parsedValue = resolved.value === "" || resolved.value == null ? Number.NaN : Number(resolved.value);
  const value = Number.isFinite(parsedValue) ? parsedValue : 0;

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
