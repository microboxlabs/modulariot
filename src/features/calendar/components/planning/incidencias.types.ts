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
    label: "Urgente",
    color: "purple",
    priority: 1,
    visibility: "primary",
  },
  shutdown: {
    label: "Shutdown",
    color: "red", // Will use custom orange styling
    priority: 2,
    visibility: "primary",
  },
  // c4, c5, c7, etc. not listed = use defaults (gray, secondary, priority 999)
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
 */
export function getIncidenciaConfig(key: string): Required<IncidenciaConfig> {
  const config = INCIDENCIA_DICTIONARY[key];
  if (!config) {
    return {
      ...DEFAULT_INCIDENCIA_CONFIG,
      label: key, // Use key as label for unlisted incidencias
    };
  }
  return {
    label: config.label ?? key,
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
