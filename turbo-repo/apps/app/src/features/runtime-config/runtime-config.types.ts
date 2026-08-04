/**
 * Runtime configuration values exposed to the client.
 * Only add keys here that are safe to expose publicly (no secrets).
 */
export interface RuntimeConfig {
  ECM_PUBLIC_URL: string;
  /**
   * Public Mapbox token loaded from the server runtime environment.
   */
  MAPBOX_API_KEY: string;
  /**
   * If "true", geographic view will filter by "Con viaje" (with trip) by default.
   * If "false" or empty, no default trip filter will be applied.
   */
  MAP_DEFAULT_TRIP_FILTER: string;
}
