/**
 * Whitelist of server env vars exposed to the client at runtime.
 * Map: client key -> server env var name.
 * Only add non-secret, public-safe values here.
 */
export const RUNTIME_CONFIG_WHITELIST: Record<string, string> = {
  ECM_API_URL: "ECM_API_URL",
} as const;
