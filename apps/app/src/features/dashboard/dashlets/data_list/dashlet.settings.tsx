"use client";

import { useState } from "react";
import { Label, Select } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig, CardLayoutConfig } from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultFilter,
  defaultCardLayout,
} from "./dashlet";
import { useSettingsState } from "../common/use-settings-state";
import { TableListSettingsShell } from "../common/table-list-settings-shell";
import { CheckboxColumnList } from "../common/settings-sections";
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
    defaultTitle: "Data List",
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

  // Card layout config (unique to data_list)
  const cl = config.cardLayout ?? defaultCardLayout;
  const [titleColumn, setTitleColumn] = useState(cl.titleColumn);
  const [subtitleColumn, setSubtitleColumn] = useState(cl.subtitleColumn);
  const [headerBadgeColumns, setHeaderBadgeColumns] = useState<string[]>(cl.headerBadgeColumns);
  const [kpiColumns, setKpiColumns] = useState<string[]>(cl.kpiColumns);
  const [footerColumns, setFooterColumns] = useState<string[]>(cl.footerColumns);

  const toggleList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    checked: boolean,
    key: string,
  ) => {
    setter((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const handleSave = () => {
    const rows = s.parseRows(
      tr("dashboard.settings.mustBeJsonArray", dictionary),
      tr("dashboard.settings.invalidJson", dictionary),
    );
    if (!rows) return;

    const { filter, sort, savedColumns, validKeys } = s.buildFilterSort();

    const cardLayout: CardLayoutConfig = {
      titleColumn: validKeys.has(titleColumn) ? titleColumn : "",
      subtitleColumn: validKeys.has(subtitleColumn) ? subtitleColumn : "",
      headerBadgeColumns: headerBadgeColumns.filter((k) => validKeys.has(k)),
      kpiColumns: kpiColumns.filter((k) => validKeys.has(k)),
      footerColumns: footerColumns.filter((k) => validKeys.has(k)),
    };

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      dataMode: s.dataMode,
      columns: savedColumns,
      rows,
      apiUrl: s.apiUrl,
      filter,
      sort,
      cardLayout,
    });
    onClose();
  };

  // Card layout section (inserted between ColumnEditor and FilterEditor)
  const cardLayoutSection = (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          {tr("dashboard.settings.cardLayout", dictionary)}
        </Label>

        <div>
          <Label htmlFor="dl-title-col" className="mb-1 block text-sm font-medium">
            {tr("dashboard.settings.titleColumn", dictionary)}
          </Label>
          <Select id="dl-title-col" sizing="sm" value={titleColumn} onChange={(e) => setTitleColumn(e.target.value)}>
            <option value="">{tr("dashboard.settings.none", dictionary)}</option>
            {s.columnsWithKeys.map((c) => (
              <option key={c._id} value={c.key}>{c.label || c.key}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="dl-subtitle-col" className="mb-1 block text-sm font-medium">
            {tr("dashboard.settings.subtitleColumn", dictionary)}
          </Label>
          <Select id="dl-subtitle-col" sizing="sm" value={subtitleColumn} onChange={(e) => setSubtitleColumn(e.target.value)}>
            <option value="">{tr("dashboard.settings.none", dictionary)}</option>
            {s.columnsWithKeys.map((c) => (
              <option key={c._id} value={c.key}>{c.label || c.key}</option>
            ))}
          </Select>
        </div>

        <CheckboxColumnList
          label={tr("dashboard.settings.headerBadgeColumns", dictionary)}
          columnsWithKeys={s.columnsWithKeys}
          selected={headerBadgeColumns}
          onToggle={(checked, key) => toggleList(setHeaderBadgeColumns, checked, key)}
        />
        <CheckboxColumnList
          label={tr("dashboard.settings.kpiGridColumns", dictionary)}
          columnsWithKeys={s.columnsWithKeys}
          selected={kpiColumns}
          onToggle={(checked, key) => toggleList(setKpiColumns, checked, key)}
        />
        <CheckboxColumnList
          label={tr("dashboard.settings.footerColumns", dictionary)}
          columnsWithKeys={s.columnsWithKeys}
          selected={footerColumns}
          onToggle={(checked, key) => toggleList(setFooterColumns, checked, key)}
        />
      </div>
    </>
  );

  return (
    <TableListSettingsShell
      id="dl"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      state={s}
      dictionary={dictionary}
    >
      {cardLayoutSection}
    </TableListSettingsShell>
  );
}
