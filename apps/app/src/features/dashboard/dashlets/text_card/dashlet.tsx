"use client";

import { useMemo } from "react";
import { Spinner } from "flowbite-react";
import type { DashletComponentProps, DashletLayoutDefaults, DataProviderEntry } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { usePgrestRows } from "../common";
import { resolveHandlebarsField, buildDataProviderContext } from "../common/use-handlebars-templates";

// ============================================================================
// Configuration Types
// ============================================================================

export type TextAlign = "left" | "center" | "right";

export interface DashletConfig {
  text: string;
  italic: boolean;
  align: TextAlign;
  dataProvider?: DataProviderEntry[];
  dataMode?: string;
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  dataSourceId?: string;
}

export const defaultConfig: DashletConfig = {
  text: "Add your text or quote here...",
  italic: true,
  align: "left",
  dataProvider: [],
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

const EMPTY_DATA_PROVIDER: DataProviderEntry[] = [];
const EMPTY_PARAMS: PgrestParam[] = [];

const ALIGN_CLASS: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    text = defaultConfig.text,
    italic = defaultConfig.italic,
    align = defaultConfig.align,
    dataProvider = EMPTY_DATA_PROVIDER,
  } = config;

  const dataMode = (config.dataMode as "static" | "pgrest") || "static";

  const { rows, loading, fetchError } = usePgrestRows(
    dataMode,
    config.pgrestFunctionName || "",
    config.pgrestHttpMethod || "POST",
    config.pgrestParams || EMPTY_PARAMS,
    config.dataSourceId,
  );

  const templateContext = useMemo(() => {
    const dpContext = buildDataProviderContext(dataProvider);
    if (dataMode === "pgrest" && rows.length > 0) {
      const firstRow = rows[0];
      return { ...dpContext, row: firstRow, ...firstRow };
    }
    return dpContext;
  }, [dataProvider, dataMode, rows]);

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

  const compiledText = resolveHandlebarsField(text, templateContext);
  const alignClass = ALIGN_CLASS[align] ?? ALIGN_CLASS.left;

  return (
    <div className="flex h-full items-center rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p
        className={`w-full text-sm text-gray-500 dark:text-gray-400 ${alignClass}${italic ? " italic" : ""}`}
      >
        {compiledText}
      </p>
    </div>
  );
}
