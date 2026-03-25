/**
 * Card Dashlet Module
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

// Re-export for direct access
export { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
export { DashletSettings } from "./dashlet.settings";
export { dashletMeta } from "./dashlet.meta";
export type { DashletConfig, CardBackgroundColor, CardIcon } from "./dashlet";

// Legacy aliases for backwards compatibility
export { Dashlet as Card } from "./dashlet";
export { DashletSettings as CardSettings } from "./dashlet.settings";
export { dashletMeta as cardMeta } from "./dashlet.meta";
export { getLayoutDefaults as getCardLayoutDefaults } from "./dashlet";
export { dashletDefinition as cardDefinition } from "./index";
