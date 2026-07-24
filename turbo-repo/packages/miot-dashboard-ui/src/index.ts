/**
 * @microboxlabs/miot-dashboard-ui — package entry.
 *
 * P1 surface: contracts (types), the six adapter seams (A–F) with providers
 * and defaults, and the config data contract (re-exported from "./schema",
 * which is also its own React-free entry). Chart dashlets will live in the
 * separate "./charts" entry so echarts never lands in this base bundle.
 */

// ---- Contracts / types ----
export * from "./types/dashboard";
export * from "./types/dashlet";
export * from "./types/roles";
export * from "./types/i18n";

// ---- Seam A: i18n ----
export {
  DashboardI18nProvider,
  useDashboardI18n,
  type DashboardI18nProviderProps,
  type DashboardI18nValue,
} from "./adapters/i18n";

// ---- Seam B: URL state / links ----
export {
  createWindowHistoryUrlStateAdapter,
  DashboardUrlStateProvider,
  useDashboardUrlState,
  useDashboardLink,
  DefaultLink,
  type UrlStateAdapter,
  type UrlStateSetOptions,
  type WindowLike,
  type DashboardLinkProps,
  type LinkComponent,
  type DashboardUrlStateProviderProps,
} from "./adapters/url-state";

// ---- Seam C: notifications ----
export {
  consoleNotify,
  DashboardNotificationsProvider,
  useDashboardNotify,
  type NotifyLevel,
  type NotifyFn,
  type DashboardNotificationsProviderProps,
} from "./adapters/notifications";

// ---- Seam D: datasources ----
export {
  DashboardDataSourcesProvider,
  useDashboardDataSources,
  type DashboardDataSource,
  type DataSourceProvider,
  type DataSourceQueryRequest,
  type DataSourceQueryResult,
  type DashboardHttpConfig,
  type DashboardDataSourcesProviderProps,
} from "./adapters/datasource";

// ---- Seam E: persistence ----
export {
  DashboardStoreProvider,
  useDashboardStore,
  type DashboardRef,
  type DashboardSummary,
  type DashboardStore,
  type DashboardStoreProviderProps,
} from "./adapters/store";

// ---- Seam F: capabilities ----
export {
  FULL_CAPABILITIES,
  READ_ONLY_CAPABILITIES,
  DashboardCapabilitiesProvider,
  useDashboardCapabilities,
  type DashboardCapabilities,
  type DashboardCapabilitiesProviderProps,
} from "./adapters/capabilities";

// ---- Persistence engine (Seam E behavior) ----
export {
  createDebouncedDashboardSaver,
  stripEphemeralState,
  DASHBOARD_SAVE_DEBOUNCE_MS,
  DASHBOARD_SAVE_MAX_RETRIES,
  DASHBOARD_SAVE_RETRY_BASE_MS,
  type DebouncedDashboardSaver,
  type DebouncedDashboardSaverOptions,
} from "./persistence/debounced-saver";

// ---- Composed root provider ----
export {
  MiotDashboardProvider,
  type MiotDashboardProviderProps,
} from "./adapters/provider";

// ---- Config data contract (also available as the "./schema" entry) ----
export * from "./schema";
