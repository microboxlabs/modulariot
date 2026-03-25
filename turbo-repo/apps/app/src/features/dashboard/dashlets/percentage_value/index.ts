/**
 * PERCENTAGE VALUE DASHLET
 * =========================
 * Standard structure following dashlet template pattern.
 *
 * Files:
 * - dashlet.tsx      → Main component (Dashlet) and config types
 * - dashlet.settings.tsx → Settings modal (DashletSettings)
 * - dashlet.meta.ts  → Metadata (dashletMeta)
 * - index.ts         → Public API (dashletDefinition)
 */

import type { DashletDefinition } from "../types";
import { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
import { DashletSettings } from "./dashlet.settings";
import { dashletMeta } from "./dashlet.meta";

// ============================================================================
// DASHLET DEFINITION (used by registry)
// ============================================================================
export const dashletDefinition: DashletDefinition = {
  meta: dashletMeta,
  Component: Dashlet,
  SettingsModal: DashletSettings,
  defaultConfig: defaultConfig as unknown as Record<string, unknown>,
  getLayoutDefaults,
};

// ============================================================================
// RE-EXPORTS for direct imports
// ============================================================================
export { Dashlet, defaultConfig, getLayoutDefaults } from "./dashlet";
export { DashletSettings } from "./dashlet.settings";
export { dashletMeta } from "./dashlet.meta";
export type { DashletConfig } from "./dashlet";
