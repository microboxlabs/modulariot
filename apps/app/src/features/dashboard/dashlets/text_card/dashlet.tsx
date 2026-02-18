"use client";

import { useMemo } from "react";
import Handlebars from "handlebars";
import type { DashletComponentProps, DashletLayoutDefaults, DataProviderEntry } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export type TextAlign = "left" | "center" | "right";

export interface DashletConfig {
  text: string;
  italic: boolean;
  align: TextAlign;
  dataProvider?: DataProviderEntry[];
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

  const templateContext = useMemo(() => {
    const data_provider: Record<string, string> = {};
    for (const entry of dataProvider) {
      if (entry.key) data_provider[entry.key] = entry.value;
    }
    return { data_provider };
  }, [dataProvider]);

  const compiledText = useMemo(() => {
    try {
      return Handlebars.compile(text)(templateContext);
    } catch {
      return text;
    }
  }, [text, templateContext]);

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
