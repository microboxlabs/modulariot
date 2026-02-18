"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export type TextAlign = "left" | "center" | "right";

export interface DashletConfig {
  text: string;
  italic: boolean;
  align: TextAlign;
}

export const defaultConfig: DashletConfig = {
  text: "Add your text or quote here...",
  italic: true,
  align: "left",
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
  } = config;

  const alignClass = ALIGN_CLASS[align] ?? ALIGN_CLASS.left;

  return (
    <div className="flex h-full items-center rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
      <p
        className={`w-full text-sm text-gray-600 dark:text-gray-300 ${alignClass}${italic ? " italic" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}
