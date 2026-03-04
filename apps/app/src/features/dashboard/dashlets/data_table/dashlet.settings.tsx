"use client";

import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { defaultColumns, defaultRows, defaultSort, defaultFilter } from "./dashlet";
import { useSettingsState } from "../common/use-settings-state";
import { TableListSettingsShell } from "../common/table-list-settings-shell";

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
    dataMode: config.dataMode,
    apiUrl: config.apiUrl,
  });

  const handleSave = () => {
    const rows = s.parseRows("Must be a JSON array", "Invalid JSON");
    if (!rows) return;

    const { filter, sort, savedColumns } = s.buildFilterSort();

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      dataMode: s.dataMode,
      columns: savedColumns,
      rows,
      apiUrl: s.apiUrl,
      filter,
      sort,
    });
    onClose();
  };

  return (
    <TableListSettingsShell
      id="dt"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      state={s}
      dictionary={dictionary}
    />
  );
}
