/**
 * Runtime configuration values exposed to the client.
 * Only add keys here that are safe to expose publicly (no secrets).
 */
export interface RuntimeConfig {
  ECM_PUBLIC_URL: string;
  /**
   * If "true", geographic view will filter by "Con viaje" (with trip) by default.
   * If "false" or empty, no default trip filter will be applied.
   */
  MAP_DEFAULT_TRIP_FILTER: string;
  /**
   * Comma-separated list of `service.origen` codes that route plan/assign
   * through workflow task moves + ECM listeners (#257, #262, #266) instead
   * of the BFF `calendar/bookings` + `/mintral/calendar/binding` path.
   * Empty (default) keeps every origin on the legacy path.
   */
  TASK_DRIVEN_ORIGINS: string;
}
