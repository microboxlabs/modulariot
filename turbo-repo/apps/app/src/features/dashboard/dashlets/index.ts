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
import { dashletDefinition as flexContainerDefinition } from "./flex_container";
import { dashletDefinition as percentageValueDefinition } from "./percentage_value";
import { dashletDefinition as statDetailedDefinition } from "./stat_detailed";
import { dashletDefinition as statIconDefinition } from "./stat_icon";
import { dashletDefinition as statCircularDefinition } from "./stat_circular";
import { dashletDefinition as statExpandableDefinition } from "./stat_expandable";
import { dashletDefinition as statStackedDefinition } from "./stat_stacked";
import { dashletDefinition as statSparklineDefinition } from "./stat_sparkline";
import { dashletDefinition as statSensitiveDefinition } from "./stat_sensitive";
import { dashletDefinition as infoCardDefinition } from "./info_card";
import { dashletDefinition as dataTableDefinition } from "./data_table";
import { dashletDefinition as dataListDefinition } from "./data_list";
import { dashletDefinition as statStatusDefinition } from "./stat_status";
import { dashletDefinition as textCardDefinition } from "./text_card";
import { dashletDefinition as chartDefinition } from "./chart";
import { dashletDefinition as fileUploadDefinition } from "./file_upload";
import { dashletDefinition as batchImportDefinition } from "./batch_import";
import { dashletDefinition as geographicMapDefinition } from "./geographic_map";

// ============================================================================
// DASHLET REGISTRY - Add new dashlets here
// ============================================================================
const DASHLET_DEFINITIONS: DashletDefinition[] = [
  containerDefinition,
  flexContainerDefinition,
  percentageValueDefinition,
  statDetailedDefinition,
  statIconDefinition,
  statCircularDefinition,
  statExpandableDefinition,
  statStackedDefinition,
  statSparklineDefinition,
  statSensitiveDefinition,
  infoCardDefinition,
  dataTableDefinition,
  dataListDefinition,
  statStatusDefinition,
  textCardDefinition,
  chartDefinition,
  fileUploadDefinition,
  batchImportDefinition,
  geographicMapDefinition,
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
 * @param _parentComponentId - The parent's componentId, or null for root level (reserved for future use)
 * @param _parentConfig - The parent's config for variant-based nesting rules (reserved for future use)
 */
export function getValidDashletsForParent(
  _parentComponentId: string | null,
  _parentConfig?: Record<string, unknown>
): DashletDefinition[] {
  // Currently all dashlets are allowed at all levels.
  // Variant-based restrictions (e.g., bento-box cannot nest bento-box)
  // are enforced at creation time via canNestIn().
  // Filter here if category or type-based restrictions are needed in the future.
  return Object.values(DASHLET_REGISTRY);
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
    actions: "Actions",
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
