/**
 * Geographic Map Dashlet Module
 *
 * Exports the complete dashlet definition for the geographic map.
 * This dashlet displays an interactive map with position markers
 * and filters.
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
export type { DashletConfig } from "./dashlet";
