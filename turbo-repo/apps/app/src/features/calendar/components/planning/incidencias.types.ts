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
 * Dictionary with optional overrides - unlisted incidencias use defaults
 * Only add entries when special styling or primary visibility is required
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
  // c4, c5, c7, etc. not listed = use defaults (gray, secondary, priority 999)
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
 * Sort incidencias by priority and split into primary/secondary groups
 */
export function categorizeIncidencias(incidencias: string[]): {
  primary: Array<{ key: string; config: Required<IncidenciaConfig> }>;
  secondary: Array<{ key: string; config: Required<IncidenciaConfig> }>;
} {
  const withConfig = incidencias.map((key) => ({
    key,
    config: getIncidenciaConfig(key),
  }));

  // Sort by priority
  withConfig.sort((a, b) => a.config.priority - b.config.priority);

  const primary = withConfig.filter((i) => i.config.visibility === "primary");
  const secondary = withConfig.filter(
    (i) => i.config.visibility === "secondary"
  );

  return { primary, secondary };
}
