/**
 * Dashlet Registry
 *
 * Central registry for all available dashlets. Provides functions to
 * retrieve dashlet definitions, filter by category, and validate nesting rules.
 */

import type { DashletDefinition, DashletMeta } from "./types";
import type { DashletCategory } from "../types/dashboard.types";

// Import dashlets
import {
  Container,
  containerMeta,
  defaultConfig as containerDefaultConfig,
} from "./container";
import {
  LabeledContainer,
  LabeledContainerSettings,
  labeledContainerMeta,
  defaultConfig as labeledContainerDefaultConfig,
} from "./labeled-container";
import {
  Card,
  CardSettings,
  cardMeta,
  defaultConfig as cardDefaultConfig,
} from "./card";

/** Registry of all available dashlets */
const DASHLET_REGISTRY: Record<string, DashletDefinition> = {
  container: {
    meta: containerMeta,
    Component: Container,
    SettingsModal: undefined,
    defaultConfig: containerDefaultConfig as unknown as Record<string, unknown>,
  },
  "labeled-container": {
    meta: labeledContainerMeta,
    Component: LabeledContainer,
    SettingsModal: LabeledContainerSettings,
    defaultConfig: labeledContainerDefaultConfig as unknown as Record<
      string,
      unknown
    >,
  },
  card: {
    meta: cardMeta,
    Component: Card,
    SettingsModal: CardSettings,
    defaultConfig: cardDefaultConfig as unknown as Record<string, unknown>,
  },
};

/**
 * Get a dashlet definition by its component ID
 */
export function getDashlet(componentId: string): DashletDefinition | undefined {
  return DASHLET_REGISTRY[componentId];
}

/**
 * Get all available dashlets
 */
export function getAllDashlets(): DashletDefinition[] {
  return Object.values(DASHLET_REGISTRY);
}

/**
 * Get all dashlet metadata (for use in selectors)
 */
export function getAllDashletMetas(): DashletMeta[] {
  return Object.values(DASHLET_REGISTRY).map((d) => d.meta);
}

/**
 * Get dashlets filtered by category
 */
export function getDashletsByCategory(
  category: DashletCategory
): DashletDefinition[] {
  return Object.values(DASHLET_REGISTRY).filter(
    (d) => d.meta.category === category
  );
}

/**
 * Get dashlets that can be nested inside a specific parent
 * @param parentComponentId - The parent's componentId, or null for root level
 */
export function getValidDashletsForParent(
  parentComponentId: string | null
): DashletDefinition[] {
  return Object.values(DASHLET_REGISTRY).filter((d) => {
    // If placing at root level, all widgets are valid
    if (parentComponentId === null) {
      return true;
    }
    // If placing inside a parent, exclude widgets marked as isRootOnly
    // (e.g., bento boxes cannot be nested inside other widgets)
    return !d.meta.isRootOnly;
  });
}

/**
 * Check if a dashlet can be nested inside a specific parent
 */
export function canNestIn(
  childComponentId: string,
  parentComponentId: string | null
): boolean {
  const dashlet = DASHLET_REGISTRY[childComponentId];
  if (!dashlet) return false;

  // If placing at root level, all widgets are valid
  if (parentComponentId === null) {
    return true;
  }

  // If placing inside a parent, check if it's not root-only
  return !dashlet.meta.isRootOnly;
}

/**
 * Get available categories
 */
export function getCategories(): DashletCategory[] {
  const categories = new Set<DashletCategory>();
  for (const dashlet of Object.values(DASHLET_REGISTRY)) {
    categories.add(dashlet.meta.category);
  }
  return Array.from(categories);
}

/**
 * Get category display name
 */
export function getCategoryLabel(category: DashletCategory): string {
  const labels: Record<DashletCategory, string> = {
    containers: "Containers",
    "data-display": "Data Display",
  };
  return labels[category];
}

// Re-export types
export type { DashletDefinition, DashletMeta } from "./types";
export type { DashletComponentProps, DashletSettingsProps } from "./types";
