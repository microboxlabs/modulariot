/**
 * Dashlet type definitions — moved to @microboxlabs/miot-dashboard-ui (P1).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export type {
  DashletLayoutDefaults,
  DataProviderEntry,
  DashletMeta,
  DashletComponentProps,
  DashletSettingsProps,
  DashletDefinition,
} from "@microboxlabs/miot-dashboard-ui";
