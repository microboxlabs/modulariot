import type { ColumnItem } from "./column-helpers";
import { humanizeKey } from "./pgrest-types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Returns the common callback portion of PgrestSettingsStateConfig
 * that is identical across data_list and data_table settings.
 */
export function buildPgrestSettingsConfig(s: {
  setColumns: (cols: ColumnItem[] | ((prev: ColumnItem[]) => ColumnItem[])) => void;
  setFilterItems: (fn: (prev: { _id: string; column: string; label: string }[]) => { _id: string; column: string; label: string }[]) => void;
  setSortColumns: (fn: (prev: string[]) => string[]) => void;
}) {
  return {
    onColumnsDetected: (keys: string[]): ColumnItem[] =>
      keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key: `{{row.${key}}}`,
        label: humanizeKey(key),
        type: "text" as const,
      })),
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
    removeParameter: tr("dashboard.settings.removeParameter", dictionary),
    loadError: tr("dashboard.settings.loadError", dictionary),
    retry: tr("common.retry", dictionary),
  };
}
