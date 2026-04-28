"use client";

import { useState } from "react";
import { HiEye, HiEyeSlash } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useDashletPgrest } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useRowThreshold } from "../common/use-threshold";
import { getThresholdTextClasses } from "../common/threshold-engine";
import type { ThresholdConfig } from "../common/threshold-types";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  isSensitive: boolean;
  thresholds?: ThresholdConfig;
}

export const defaultConfig: DashletConfig = {
  title: "Account Balance",
  value: "125847.32",
  unit: "$",
  isSensitive: true,
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Account Balance",
  value: "125847.32",
  unit: "$",
};

function getValueTextClasses(
  thresholdColor: string | null,
  appliesTo: (
    target: import("../common/threshold-types").ThresholdTarget
  ) => boolean
): string {
  if (thresholdColor && appliesTo("text"))
    return getThresholdTextClasses(thresholdColor);
  return "text-gray-900 dark:text-white";
}

// ============================================================================
// Component - Style 10: Sensitive Data (Hidden by default)
// ============================================================================

/**
 * Sensitive Data Card - Value hidden until user clicks to reveal
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const isSensitive = config.isSensitive ?? true;
  const [isHidden, setIsHidden] = useState(isSensitive);
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError, firstRow } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  const { color: thresholdColor, appliesTo } = useRowThreshold(
    config.thresholds,
    firstRow
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Account Balance";
  const unit = resolved.unit ?? "$";
  const parsedValue =
    resolved.value === "" || resolved.value == null
      ? Number.NaN
      : Number(resolved.value);
  const formattedValue = Number.isFinite(parsedValue)
    ? `${unit}${parsedValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `${unit}${resolved.value}`;

  const displayValue = isHidden ? "••••••" : formattedValue;

  return (
    <div className="flex h-full flex-col justify-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <button
          type="button"
          onClick={() => setIsHidden(!isHidden)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label={isHidden ? "Show value" : "Hide value"}
        >
          {isHidden ? (
            <HiEye className="h-5 w-5" />
          ) : (
            <HiEyeSlash className="h-5 w-5" />
          )}
        </button>
      </div>

      <p
        className={`mt-2 text-3xl font-bold transition-all ${
          isHidden
            ? "text-gray-400 dark:text-gray-500"
            : getValueTextClasses(thresholdColor, appliesTo)
        }`}
      >
        {displayValue}
      </p>

      {isHidden && (
        <p className="mt-2 text-xs text-gray-400">Click eye icon to reveal</p>
      )}
    </div>
  );
}
