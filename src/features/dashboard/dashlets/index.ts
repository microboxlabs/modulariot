/**
 * Dashlet Registry
 *
 * Central registry for all available dashlets. Provides functions to
 * retrieve dashlet definitions, filter by category, and validate nesting rules.
 *
 * TO ADD A NEW DASHLET:
 * 1. Copy _template folder to your-dashlet-name
 * 2. Update dashlet.meta.ts (set id to folder name)
 * 3. Import { dashletDefinition as yourDashletDefinition } below
 * 4. Add yourDashletDefinition to DASHLET_DEFINITIONS array
 */

import type { DashletDefinition, DashletMeta } from "./types";
import type { DashletCategory } from "../types/dashboard.types";
import type { ContainerConfig, ContainerVariant } from "./container";

// Import dashlet definitions (each folder exports dashletDefinition)
import { dashletDefinition as containerDefinition } from "./container";
import { dashletDefinition as cardDefinition } from "./card";
import { dashletDefinition as labeledDataDefinition } from "./labeled_data";

// ============================================================================
// DASHLET REGISTRY - Add new dashlets here
// ============================================================================
const DASHLET_DEFINITIONS: DashletDefinition[] = [
  containerDefinition,
  cardDefinition,
  labeledDataDefinition,
];

/** Registry of all available dashlets */
const DASHLET_REGISTRY: Record<string, DashletDefinition> =
  DASHLET_DEFINITIONS.reduce<Record<string, DashletDefinition>>(
    (registry, definition) => {
      registry[definition.meta.id] = definition;
      return registry;
    },
    {}
  );

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
 * @param parentConfig - The parent's config for variant-based nesting rules
 */
export function getValidDashletsForParent(
  parentComponentId: string | null,
  parentConfig?: Record<string, unknown>
): DashletDefinition[] {
  return Object.values(DASHLET_REGISTRY).filter((d) => {
    // If placing at root level, all widgets are valid
    if (parentComponentId === null) {
      return true;
    }
    // If parent is a container with bento-box variant, only allow non-bento-box containers
    // (labeled-group can be nested inside bento-box)
    if (parentComponentId === "container") {
      const parentVariant = (parentConfig as ContainerConfig | undefined)
        ?.variant;
      if (parentVariant === "bento-box" && d.meta.id === "container") {
        // Container can only be added if it will be a labeled-group (context-aware default)
        // We allow it because the default variant when nested will be labeled-group
        return true;
      }
    }
    return true;
  });
}

/**
 * Check if a dashlet can be nested inside a specific parent
 * @param childComponentId - The child's componentId
 * @param parentComponentId - The parent's componentId, or null for root level
 * @param childVariant - The child's variant (for containers)
 * @param parentConfig - The parent's config for variant-based nesting rules
 */
export function canNestIn(
  childComponentId: string,
  parentComponentId: string | null,
  childVariant?: ContainerVariant,
  parentConfig?: Record<string, unknown>
): boolean {
  const dashlet = DASHLET_REGISTRY[childComponentId];
  if (!dashlet) return false;

  // If placing at root level, all widgets are valid
  if (parentComponentId === null) {
    return true;
  }

  // Container variant-based nesting rules:
  // - bento-box cannot be nested inside another bento-box
  // - labeled-group can be nested anywhere
  if (childComponentId === "container" && parentComponentId === "container") {
    const parentVariant = (parentConfig as ContainerConfig | undefined)
      ?.variant;
    // If parent is bento-box, child cannot be bento-box
    if (parentVariant === "bento-box" && childVariant === "bento-box") {
      return false;
    }
  }

  return true;
}

/**
 * Get the default variant for a new container based on context
 * @param parentComponentId - The parent's componentId, or null for root level
 */
export function getDefaultContainerVariant(
  parentComponentId: string | null
): ContainerVariant {
  // At root level, default to bento-box
  if (parentComponentId === null) {
    return "bento-box";
  }
  // When nested inside any container, default to labeled-group
  return "labeled-group";
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
export type {
  DashletDefinition,
  DashletMeta,
  DashletLayoutDefaults,
} from "./types";
export type { DashletComponentProps, DashletSettingsProps } from "./types";
