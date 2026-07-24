/**
 * PgREST settings-state builders — moved to @microboxlabs/miot-dashboard-ui (P3).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly. Only
 * buildPgrestContentLabels stays app-side: it renders through the app's tr()
 * i18n; it migrates to the injected Translate seam (Seam A) with the settings
 * UI in P4/P5.
 */
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export type { SimplePgrestSettingsConfig } from "@microboxlabs/miot-dashboard-ui";

export {
  defaultOnColumnsDetected,
  buildSimplePgrestConfig,
  buildColumnsFromKeys,
  syncColumnsFromKeys,
  buildPgrestSettingsConfig,
} from "@microboxlabs/miot-dashboard-ui";

/**
 * Returns the labels object for PgrestSettingsSection, shared across dashlet settings.
 */
export function buildPgrestContentLabels(dictionary: I18nRecord) {
  return {
    functionName: tr("dashboard.settings.functionName", dictionary),
    httpMethod: tr("dashboard.settings.httpMethod", dictionary),
    parameters: tr("dashboard.settings.parameters", dictionary),
    key: tr("dashboard.settings.key", dictionary),
    value: tr("common.value", dictionary),
    addParameter: tr("dashboard.settings.addParameter", dictionary),
  };
}
