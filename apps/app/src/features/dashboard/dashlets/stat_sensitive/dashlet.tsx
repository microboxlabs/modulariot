"use client";

import { useState, useMemo } from "react";
import { Spinner } from "flowbite-react";
import { HiEye, HiEyeSlash } from "react-icons/hi2";
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
  isSensitive: boolean;
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
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

  const fields = useMemo(
    () => ({
      title: config.title || "Account Balance",
      value: String(config.value ?? "125847.32"),
      unit: config.unit ?? "$",
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

  const title = resolved.title || "Account Balance";
  const unit = resolved.unit ?? "$";
  const parsedValue = resolved.value === "" || resolved.value == null ? Number.NaN : Number(resolved.value);
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
            : "text-gray-900 dark:text-white"
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
