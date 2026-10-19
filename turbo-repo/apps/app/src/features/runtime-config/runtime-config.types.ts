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
  /**
   * If "true", the reference-only "Dev" section (extensions/components
   * galleries) appears in navigation and its routes resolve. Anything else,
   * including empty, keeps it hidden.
   */
  ENABLE_DEV_TOOLS: string;
  /**
   * Comma-separated list of `service.origen` codes that route plan/assign
   * through workflow task moves + ECM listeners (#257, #262, #266) instead
   * of the BFF `calendar/bookings` + `/mintral/calendar/binding` path.
   * Empty (default) keeps every origin on the legacy path.
   */
  TASK_DRIVEN_ORIGINS: string;
  /**
   * If "true", the storytelling section (nav entry + /storytelling routes)
   * is reachable and the chat's "show all dashlets" demo trigger fires.
   * Anything else, including empty, keeps it off.
   */
  ENABLE_STORYTELLING: string;
  /**
   * If "true", the symptoms map-view prototype does not send its saves to the
   * real backend (treatments and the invalidate-symptom webhook) and shows
   * mock contact and call data.
   */
  SYMPTOMS_PROTOTYPE_DISABLE_API: string;
  /**
   * If "true", the symptoms map-view opens the previous full-screen treatment
   * modal instead of the inline forms.
   */
  SYMPTOMS_PAST_FORMS: string;
}
