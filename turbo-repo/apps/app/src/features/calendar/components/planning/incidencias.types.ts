/**
 * Configuration for incidencia display overrides
 */
export interface IncidenciaConfig {
  /** Display label (defaults to key) */
  label?: string;
  /** Tailwind color class for Flowbite Badge (defaults to "gray") */
  color?: "purple" | "red" | "yellow" | "green" | "blue" | "gray" | "pink";
  /** Sort priority (lower = first, defaults to 999) */
  priority?: number;
  /** Visibility tier: 'primary' always visible, 'secondary' collapsed behind "+N more" */
  visibility?: "primary" | "secondary";
}

/**
 * Dictionary with optional overrides - unlisted incidencias use defaults.
 * Priorities mirror the backend `mintral_calendarPlanningPriority` tier
 * hierarchy in ecm-coordinator MintralModel.INCIDENT_TIER_BY_CODE so per-card
 * badge stacking matches the sidebar's global list order.
 *
 *   tier 1 (priority 1): C309
 *   tier 2 (priority 2): C307, C314, C319, C320, C326, C329
 *   tier 3 (priority 3): C308
 *   tier 4 (default 999): everything else
 */
export const INCIDENCIA_DICTIONARY: Record<string, IncidenciaConfig> = {
  urgencia: {
    label: "C309",
    color: "purple",
    priority: 1,
    visibility: "primary",
  },
  shutdown: {
    label: "C307",
    color: "red", // Will use custom orange styling
    priority: 2,
    visibility: "primary",
  },
  // Tier-2 codes — primary visibility, default color (gray) until a design
  // refresh adds an orange palette token.
  C314: { priority: 2, visibility: "primary" },
  C319: { priority: 2, visibility: "primary" },
  C320: { priority: 2, visibility: "primary" },
  C326: { priority: 2, visibility: "primary" },
  C329: { priority: 2, visibility: "primary" },
  // Tier-3 code — primary visibility, default color.
  C308: { priority: 3, visibility: "primary" },
};

/**
 * Reverse mapping from labels to dictionary keys
 * Used when we have labels from mintral_incidents instead of keys
 * Maps both exact labels and case-insensitive variants
 */
const LABEL_TO_KEY_MAP: Record<string, string> = {
  // Code mappings (from mintral_incidents first value after removing prefix)
  "C309": "urgencia",
  "c309": "urgencia",
  "C307": "shutdown",
  "c307": "shutdown",
  // Label mappings (from mintral_incidents second value)
  "DESPACHO URGENTE": "urgencia",
  "despacho urgente": "urgencia",
  "SHUTDOWN": "shutdown",
  "shutdown": "shutdown",
  // Add more mappings as needed
};

/**
 * Default configuration for incidencias not in dictionary
 */
export const DEFAULT_INCIDENCIA_CONFIG: Required<IncidenciaConfig> = {
  label: "", // Will use key as label
  color: "gray",
  priority: 999,
  visibility: "secondary",
};

/**
 * Get the configuration for a specific incidencia
 * Returns merged config with defaults for missing properties
 * Supports both keys (e.g., "urgencia", "shutdown") and labels (e.g., "DESPACHO URGENTE", "SHUTDOWN")
 */
export function getIncidenciaConfig(keyOrLabel: string): Required<IncidenciaConfig> {
  // First try direct lookup (for keys like "urgencia", "shutdown")
  let config = INCIDENCIA_DICTIONARY[keyOrLabel];  
  
  // If not found, try reverse lookup by label (for labels like "DESPACHO URGENTE", "SHUTDOWN")
  if (!config) {
    const mappedKey = LABEL_TO_KEY_MAP[keyOrLabel];
    if (mappedKey) {      
      config = INCIDENCIA_DICTIONARY[mappedKey];
    }
  }
  
  // Also try case-insensitive lookup as fallback
  if (!config) {
    const lowerKey = keyOrLabel.toLowerCase();
    if (INCIDENCIA_DICTIONARY[lowerKey]) {      
      config = INCIDENCIA_DICTIONARY[lowerKey];
    }
  }
  
  if (!config) {
    return {
      ...DEFAULT_INCIDENCIA_CONFIG,
      label: keyOrLabel, // Use the provided key/label as-is for unlisted incidencias
    };
  }
  
  return {
    label: config.label ?? keyOrLabel,
    color: config.color ?? DEFAULT_INCIDENCIA_CONFIG.color,
    priority: config.priority ?? DEFAULT_INCIDENCIA_CONFIG.priority,
    visibility: config.visibility ?? DEFAULT_INCIDENCIA_CONFIG.visibility,
  };
}

/**
 * Whether an incident code participates in the calendar planning sort.
 *
 * Mirrors ecm-coordinator `MintralModel.INCIDENT_TIER_BY_CODE`: only codes
 * with an explicit tier — C309 (1); C307/C314/C319/C320/C326/C329 (2);
 * C308 (3) — are sort-relevant. Everything else falls to the default tier
 * and is intentionally hidden in the planner (issue #677).
 */
export function isSortingRelevant(keyOrLabel: string): boolean {
  return (
    getIncidenciaConfig(keyOrLabel).priority !==
    DEFAULT_INCIDENCIA_CONFIG.priority
  );
}

/**
 * The incidencias to render in the planner, in sort (tier) order.
 *
 * Only sort-relevant codes are returned, so the sidebar and grid chips show
 * exactly the flags the backend sort ranks on — and nothing else. Non-tiered
 * incident codes carried by a service are dropped here.
 */
export function getDisplayIncidencias(
  incidencias: string[]
): Array<{ key: string; config: Required<IncidenciaConfig> }> {
  return incidencias
    .filter(isSortingRelevant)
    .map((key) => ({ key, config: getIncidenciaConfig(key) }))
    .sort((a, b) => a.config.priority - b.config.priority);
}
