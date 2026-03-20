"use client";

import { useMemo } from "react";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { useDashletPgrest, DashletLoading, DashletError, parseResolvedNumber } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  unit: string;
  sparkline: number[];
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
}

export const defaultConfig: DashletConfig = {
  title: "Page Views",
  value: "24567",
  unit: "",
  sparkline: [30, 45, 35, 50, 40, 60, 55, 70, 65, 80, 75, 90],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 9: Sparkline
// ============================================================================

/**
 * Sparkline Card - Mini line chart in the background
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const sparkline = config.sparkline || defaultConfig.sparkline;

  const fields = useMemo(
    () => ({
      title: config.title || "Page Views",
      value: String(config.value ?? "24567"),
      unit: config.unit ?? "",
    }),
    [config.title, config.value, config.unit],
  );

  const { resolved, loading, fetchError } = useDashletPgrest(config, fields);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Page Views";
  const unit = resolved.unit ?? "";
  const value = parseResolvedNumber(resolved.value);

  const min = Math.min(...sparkline);
  const max = Math.max(...sparkline);
  const range = max - min || 1;

  // Generate SVG path for sparkline
  const width = 200;
  const height = 50;
  const points = sparkline
    .map((v, i) => {
      const x = (i / (sparkline.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const pathD = `M ${points}`;
  const areaD = `M 0,${height} L ${points} L ${width},${height} Z`;

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Sparkline background */}
      <svg
        className="absolute bottom-0 left-0 right-0 h-16 w-full opacity-20"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path d={areaD} className="fill-blue-500" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 right-0 h-16 w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-blue-500"
        />
      </svg>

      {/* Content */}
      <div className="relative">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
          {unit && <span className="ml-1 text-lg font-normal">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
