/**
 * Dashlet Module Index
 *
 * This file wires everything together. You shouldn't need to edit this
 * unless you're adding new exports.
 *
 * To register this dashlet:
 * 1. Import { dashletDefinition } from "./your-folder-name"
 * 2. Add it to DASHLET_DEFINITIONS array in dashlets/index.ts
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
