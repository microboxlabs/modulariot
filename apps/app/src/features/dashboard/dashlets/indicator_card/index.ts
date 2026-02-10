/**
 * Indicator Card Dashlet Module
 *
 * A dashlet that fetches data from a configurable API endpoint and displays
 * the value with color-coded thresholds. Supports:
 * - Configurable title and description
 * - API URL with JSON path extraction
 * - Multiple color threshold ranges
 */

import type { DashletDefinition } from "../types";
import { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
import { DashletSettings } from "./dashlet.settings";
import { dashletMeta } from "./dashlet.meta";

/** Complete dashlet definition - import this in the registry */
export const dashletDefinition: DashletDefinition = {
  meta: dashletMeta,
  Component: Dashlet,
  SettingsModal: DashletSettings,
  defaultConfig: defaultConfig as unknown as Record<string, unknown>,
  getLayoutDefaults,
};

// Re-export individual pieces if needed elsewhere
export { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
export { DashletSettings } from "./dashlet.settings";
export { dashletMeta } from "./dashlet.meta";
export type { DashletConfig, ColorThreshold, ThresholdColor } from "./dashlet";
