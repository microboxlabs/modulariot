"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultFilter,
} from "./dashlet";
import { useSettingsState } from "../common/use-settings-state";
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { PgrestSettingsSection } from "../common/pgrest-settings-section";
import { TableListSettingsShell } from "../common/table-list-settings-shell";
import { fromPgrestParamItems, humanizeKey } from "../common/pgrest-types";
import { tr } from "@/features/i18n/tr.service";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const s = useSettingsState({
    title: config.title,
    defaultTitle: "Data Table",
    showRowCount: config.showRowCount,
    columns: config.columns,
    defaultColumns,
    rows: config.rows,
    defaultRows,
    filter: config.filter,
    defaultFilter,
    sort: config.sort,
    defaultSort,
    dataMode: config.dataMode === "pgrest" ? "pgrest" : (config.dataMode ?? "static"),
    apiUrl: "",
  });

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    onColumnsDetected: (keys) =>
      keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key: `{{row.${key}}}`,
        label: humanizeKey(key),
        type: "text" as const,
      })),
    setColumns: s.setColumns,
    syncFiltersToColumns: (detectedKeys, labelByKey) => {
      s.setFilterItems((prev) =>
        prev.map((fi) => {
          const firstKey = [...detectedKeys][0] ?? "";
          const column = detectedKeys.has(fi.column) ? fi.column : firstKey;
          return { ...fi, column, label: labelByKey.get(column) ?? fi.label };
        }),
      );
    },
    syncSortToColumns: (detectedKeys) => {
      s.setSortColumns((prev) => prev.filter((k) => detectedKeys.has(k)));
    },
  });

  const handleSave = () => {
    const rows = s.parseRows(
      tr("dashboard.settings.mustBeJsonArray", dictionary),
      tr("dashboard.settings.invalidJson", dictionary),
    );
    if (!rows) return;

    const { filter, sort, savedColumns } = s.buildFilterSort();

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      dataMode: s.dataMode as "static" | "pgrest",
      columns: savedColumns,
      rows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      filter,
      sort,
    });
    onClose();
  };

  const pgrestContent = (
    <PgrestSettingsSection
      pgrest={pg}
      labels={{
        functionName: tr("dashboard.settings.functionName", dictionary),
        httpMethod: tr("dashboard.settings.httpMethod", dictionary),
        parameters: tr("dashboard.settings.parameters", dictionary),
        key: tr("dashboard.settings.key", dictionary),
        value: tr("common.value", dictionary),
        addParameter: tr("dashboard.settings.addParameter", dictionary),
      }}
    />
  );

  return (
    <TableListSettingsShell
      id="dt"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      state={s}
      dictionary={dictionary}
      dataTabChildren={pgrestContent}
      handlebarsColorKeys
    />
  );
}
