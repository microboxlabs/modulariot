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
import { usePgrestSettingsState } from "../common/use-pgrest-settings-state";
import { PgrestSettingsSection } from "../common/pgrest-settings-section";
import { TableListSettingsShell } from "../common/table-list-settings-shell";
import { CheckboxColumnList } from "../common/settings-sections";
import { fromPgrestParamItems } from "../common/pgrest-types";
import { buildPgrestSettingsConfig, buildPgrestContentLabels } from "../common/pgrest-settings-helpers";
import { tr } from "@/features/i18n/tr.service";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);
  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

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
    dataMode: config.dataMode ?? "static",
    apiUrl: config.apiUrl,
  });

  // Card layout config (unique to data_list)
  const cl = config.cardLayout ?? defaultCardLayout;
  const [titleColumn, setTitleColumn] = useState(cl.titleColumn);
  const [subtitleColumn, setSubtitleColumn] = useState(cl.subtitleColumn);
  const [headerBadgeColumns, setHeaderBadgeColumns] = useState<string[]>(cl.headerBadgeColumns);
  const [kpiColumns, setKpiColumns] = useState<string[]>(cl.kpiColumns);
  const [footerColumns, setFooterColumns] = useState<string[]>(cl.footerColumns);

  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    dataSourceId: dataSourceId || undefined,
    ...buildPgrestSettingsConfig(s),
    onDetectionComplete: (detected) => {
      const keys = detected.map((c) => c.key);
      setTitleColumn(keys[0] ?? "");
      setSubtitleColumn(keys[1] ?? "");
      setHeaderBadgeColumns(keys.length > 2 ? [keys[2]] : []);
      setKpiColumns(keys.slice(3, 9));
      setFooterColumns(keys.slice(9, 11));
    },
  });

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
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      dataSourceId: dataSourceId || undefined,
      filter,
      sort,
      cardLayout,
    });
    onClose();
  };

  const pgrestContent = (
    <PgrestSettingsSection
      pgrest={pg}
      dictionary={dictionary}
      labels={buildPgrestContentLabels(dictionary)}
      dataSourceId={dataSourceId}
      onDataSourceIdChange={setDataSourceId}
      activeProviders={activeProviders}
    />
  );

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
      dataTabChildren={pgrestContent}
      handlebarsColorKeys
    >
      {cardLayoutSection}
    </TableListSettingsShell>
  );
}
