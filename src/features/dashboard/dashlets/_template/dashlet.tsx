"use client";

import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

/** Configuration for this dashlet */
export interface DashletConfig {
  // Add your config properties here
  title: string;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Default Title",
};

// ============================================================================
// Layout Defaults
// ============================================================================

/** Grid layout constraints */
export const layoutDefaults: DashletLayoutDefaults = {
  minW: 2,
  minH: 1,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dashlet Component
 *
 * Edit this component to customize how the dashlet renders.
 * The `widget.config` contains the configuration from DashletConfig.
 */
export function Dashlet({ widget }: DashletComponentProps) {
  const config = widget.config as unknown as DashletConfig;

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-gray-900 dark:text-white">{config.title}</p>
      {/* Add your dashlet content here */}
    </div>
  );
}
