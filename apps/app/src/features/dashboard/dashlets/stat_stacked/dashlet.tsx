"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import { useDashletPgrest, DashletLoading, DashletError } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

export type BarColor =
  | "bg-blue-500 dark:bg-blue-400"
  | "bg-green-500 dark:bg-green-400"
  | "bg-yellow-500 dark:bg-yellow-400"
  | "bg-purple-500 dark:bg-purple-400"
  | "bg-red-500 dark:bg-red-400"
  | "bg-cyan-500 dark:bg-cyan-400";

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  items: { label: string; value: number; color: BarColor }[];
  unit: string;
  showHeader: boolean;
}

export const defaultConfig: DashletConfig = {
  title: "Traffic Sources",
  items: [
    { label: "Direct", value: 45, color: "bg-blue-500 dark:bg-blue-400" },
    { label: "Organic", value: 30, color: "bg-green-500 dark:bg-green-400" },
    { label: "Referral", value: 15, color: "bg-yellow-500 dark:bg-yellow-400" },
    { label: "Social", value: 10, color: "bg-purple-500 dark:bg-purple-400" },
  ],
  unit: "%",
  showHeader: true,
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 3,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = { title: "Traffic Sources", unit: "%" };

// ============================================================================
// Component - Style 8: Stacked Bars
// ============================================================================

/**
 * Stacked Bars Card - Multiple items with horizontal bars
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { items, showHeader = true } = config;

  const { resolved, loading, fetchError } = useDashletPgrest(config, FIELD_DEFAULTS);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Traffic Sources";
  const unit = resolved.unit ?? "%";
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${showHeader ? "" : "justify-center"}`}
    >
      {/* Header */}
      {showHeader && (
        <>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total}
            <span className="ml-1 text-sm font-normal text-gray-500">
              {unit}
            </span>
          </p>
        </>
      )}

      {/* Stacked bar */}
      <div
        className={`flex h-3 overflow-hidden rounded-full ${showHeader ? "mt-3" : ""}`}
      >
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {item.label}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {item.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
