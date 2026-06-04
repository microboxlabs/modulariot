/**
 * Whitelist of server env vars exposed to the client at runtime.
 * Map: client key -> server env var name.
 * Only add non-secret, public-safe values here.
 */
export const RUNTIME_CONFIG_WHITELIST: Record<string, string> = {
  ECM_PUBLIC_URL: "ECM_PUBLIC_URL",
  MAPBOX_API_KEY: "MAPBOX_API_KEY",
  MAP_DEFAULT_TRIP_FILTER: "MAP_DEFAULT_TRIP_FILTER",
  TASK_DRIVEN_ORIGINS: "TASK_DRIVEN_ORIGINS",
} as const;
