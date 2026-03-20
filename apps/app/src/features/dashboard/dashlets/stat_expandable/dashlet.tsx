"use client";

import { useState, useMemo } from "react";
import { Spinner } from "flowbite-react";
import { HiChevronDown, HiChevronUp } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestResolvedFields } from "../common";

const EMPTY_PARAMS: PgrestParam[] = [];

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig {
  title: string;
  value: string;
  unit: string;
  details: { label: string; value: string }[];
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
}

export const defaultConfig: DashletConfig = {
  title: "Conversion Rate",
  value: "3.24",
  unit: "%",
  details: [
    { label: "Visitors", value: "12,847" },
    { label: "Conversions", value: "416" },
    { label: "Avg. Time", value: "2m 34s" },
    { label: "Bounce Rate", value: "42%" },
  ],
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component - Style 6: Expandable Details
// ============================================================================

/**
 * Expandable Card - Click to expand and show more details
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const details = config.details || defaultConfig.details;
  const [expanded, setExpanded] = useState(false);

  const fields = useMemo(
    () => ({
      title: config.title || "Conversion Rate",
      value: String(config.value ?? "3.24"),
      unit: config.unit ?? "%",
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

  const title = resolved.title || "Conversion Rate";
  const unit = resolved.unit ?? "%";
  const parsedValue = resolved.value === "" || resolved.value == null ? Number.NaN : Number(resolved.value);
  const displayValue = Number.isFinite(parsedValue) ? parsedValue : resolved.value;

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Main content */}
      <div className="flex flex-1 flex-col justify-center p-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
          {displayValue}
          <span className="ml-1 text-lg font-normal text-gray-500">{unit}</span>
        </p>
      </div>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-1 border-t border-gray-200 py-2 text-xs text-blue-600 hover:bg-gray-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-700"
      >
        {expanded ? (
          <>
            Hide details <HiChevronUp className="h-4 w-4" />
          </>
        ) : (
          <>
            Show details <HiChevronDown className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="grid grid-cols-2 gap-2">
            {details.map((detail) => (
              <div key={detail.label}>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {detail.label}
                </p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {detail.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
