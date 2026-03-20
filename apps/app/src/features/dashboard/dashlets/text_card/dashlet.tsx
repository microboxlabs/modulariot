"use client";

import { useMemo } from "react";
import type { DashletComponentProps, DashletLayoutDefaults, DataProviderEntry } from "../types";
import type { PgrestParam, PgrestHttpMethod } from "../common";
import { useHybridPgrestContext, DashletLoading, DashletError } from "../common";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";

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

  const { templateContext, loading, fetchError } = useHybridPgrestContext(config, dataProvider);

  const compiledText = useMemo(() => resolveHandlebarsField(text, templateContext), [text, templateContext]);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;
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
