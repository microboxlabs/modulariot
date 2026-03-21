import type { ColumnItem } from "./column-helpers";
import { humanizeKey } from "./pgrest-types";
import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import type { PgrestSettingsStateConfig } from "./use-pgrest-settings-state";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Default onColumnsDetected callback for simple dashlets (labeled_data, card)
 * that use raw keys without handlebars wrapping.
 */
export function defaultOnColumnsDetected(keys: string[]): ColumnItem[] {
  return keys.map((key, i) => ({
    _id: `col-${Date.now()}-${i}`,
    key,
    label: humanizeKey(key),
    type: "text" as const,
  }));
}

/**
 * Builds the common portion of PgrestSettingsStateConfig for simple dashlets
 * (labeled_data, card) that use raw keys and a no-op setColumns.
 */
export function buildSimplePgrestConfig(
  config: { pgrestFunctionName?: string; pgrestParams?: PgrestParam[]; pgrestHttpMethod?: PgrestHttpMethod },
  onDetectionComplete?: PgrestSettingsStateConfig["onDetectionComplete"],
): Pick<PgrestSettingsStateConfig, "pgrestFunctionName" | "pgrestParams" | "pgrestHttpMethod" | "onColumnsDetected" | "setColumns" | "onDetectionComplete"> {
  return {
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestParams: config.pgrestParams || [],
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    onColumnsDetected: defaultOnColumnsDetected,
    setColumns: () => {},
    onDetectionComplete,
  };
}

/**
 * Builds ColumnItem[] from raw keys using `{{row.key}}` format and humanized labels.
 * Reusable by both pgrest auto-detection and planner schema sync.
 */
export function buildColumnsFromKeys(keys: string[]): ColumnItem[] {
  return keys.map((key, i) => ({
    _id: `col-${Date.now()}-${i}`,
    key: `{{row.${key}}}`,
    label: humanizeKey(key),
    type: "text" as const,
  }));
}

type SettingsStateSyncer = {
  setColumns: (cols: ColumnItem[] | ((prev: ColumnItem[]) => ColumnItem[])) => void;
  setFilterItems: (fn: (prev: { _id: string; column: string; label: string }[]) => { _id: string; column: string; label: string }[]) => void;
  setSortColumns: (fn: (prev: string[]) => string[]) => void;
};

/**
 * Full sync: builds columns from keys, sets them, syncs filters & sort.
 * Optionally calls onDetectionComplete with the built columns.
 */
export function syncColumnsFromKeys(
  keys: string[],
  s: SettingsStateSyncer,
  onDetectionComplete?: (cols: ColumnItem[]) => void,
) {
  const cols = buildColumnsFromKeys(keys);
  s.setColumns(cols);

  const detectedKeys = new Set(cols.map((c) => c.key));
  const labelByKey = new Map(cols.map((c) => [c.key, c.label]));

  s.setFilterItems((prev) =>
    prev.map((fi) => {
      const firstKey = [...detectedKeys][0] ?? "";
      const column = detectedKeys.has(fi.column) ? fi.column : firstKey;
      return { ...fi, column, label: labelByKey.get(column) ?? fi.label };
    }),
  );
  s.setSortColumns((prev) => prev.filter((k) => detectedKeys.has(k)));

  onDetectionComplete?.(cols);
}

/**
 * Returns the common callback portion of PgrestSettingsStateConfig
 * that is identical across data_list and data_table settings.
 */
export function buildPgrestSettingsConfig(s: SettingsStateSyncer) {
  return {
    onColumnsDetected: (keys: string[]): ColumnItem[] => buildColumnsFromKeys(keys),
    setColumns: s.setColumns,
    syncFiltersToColumns: (detectedKeys: Set<string>, labelByKey: Map<string, string>) => {
      s.setFilterItems((prev) =>
        prev.map((fi) => {
          const firstKey = [...detectedKeys][0] ?? "";
          const column = detectedKeys.has(fi.column) ? fi.column : firstKey;
          return { ...fi, column, label: labelByKey.get(column) ?? fi.label };
        }),
      );
    },
    syncSortToColumns: (detectedKeys: Set<string>) => {
      s.setSortColumns((prev) => prev.filter((k) => detectedKeys.has(k)));
    },
  };
}

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
