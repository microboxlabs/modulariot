"use client";

import { useMemo } from "react";
import { HiShoppingCart } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import { useDashletPgrest, DashletLoading, DashletError, parseResolvedNumber } from "../common";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  subtitle: string;
}

export const defaultConfig: DashletConfig = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 4: Icon Accent
// ============================================================================

/**
 * Icon Accent Card - Large icon with accent color
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;

  const fields = useMemo(
    () => ({
      title: config.title || "Orders",
      value: String(config.value ?? "156"),
      unit: config.unit ?? "",
      subtitle: config.subtitle || "Last 24 hours",
    }),
    [config.title, config.value, config.unit, config.subtitle],
  );

  const { resolved, loading, fetchError } = useDashletPgrest(config, fields);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Orders";
  const unit = resolved.unit ?? "";
  const subtitle = resolved.subtitle || "";
  const value = parseResolvedNumber(resolved.value);

  return (
    <div className="flex h-full items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Icon */}
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
        <HiShoppingCart className="h-7 w-7 text-blue-600 dark:text-blue-400" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
          {unit && <span className="ml-1 text-base font-normal">{unit}</span>}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
