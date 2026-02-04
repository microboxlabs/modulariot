/**
 * LABELED DATA DASHLET
 * =====================
 * Standard structure following dashlet template pattern.
 *
 * Files:
 * - dashlet.tsx      → Main component (Dashlet) and config types
 * - dashlet.settings.tsx → Settings modal (DashletSettings)
 * - dashlet.meta.ts  → Metadata (dashletMeta)
 * - index.ts         → Public API (dashletDefinition)
 */

import type { DashletDefinition } from "../types";
import {
  Dashlet,
  defaultConfig,
  getLayoutDefaults,
  layoutDefaults,
} from "./dashlet";
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
// LEGACY ALIASES (for backwards compatibility)
// ============================================================================
export {
  Dashlet as LabeledData,
  defaultConfig as labeledDataDefaultConfig,
  getLayoutDefaults as getLabeledDataLayoutDefaults,
  layoutDefaults as labeledDataLayoutDefaults,
  DashletSettings as LabeledDataSettings,
  dashletMeta as labeledDataMeta,
};

/** @deprecated Use dashletDefinition instead */
export const labeledDataDefinition = dashletDefinition;

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type {
  DashletConfig as LabeledDataConfig,
  BackgroundColor as LabeledDataBackgroundColor,
  IconType as LabeledDataIcon,
} from "./dashlet";
