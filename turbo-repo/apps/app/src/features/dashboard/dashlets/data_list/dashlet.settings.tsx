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
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { CheckboxColumnList } from "../common/settings-sections";
import { fromPgrestParamItems } from "../common/pgrest-types";
import {
  buildPgrestSettingsConfig,
  buildPgrestContentLabels,
  syncColumnsFromKeys,
} from "../common/pgrest-settings-helpers";
import { PlannerVariableSelector } from "../common/planner-variable-selector";
import { useActiveProviders } from "../common/use-active-providers";
import { tr } from "@/features/i18n/tr.service";
import { useDashboardFilterSuggestions } from "../common/use-filter-suggestions";
import { useSchemaSuggestions } from "../common/use-schema-suggestions";

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
  dashletName,
  widgetId,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const refresh = useWidgetRefreshSettings(config, dictionary);
  const activeProviders = useActiveProviders();
  const filterSuggestions = useDashboardFilterSuggestions();

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

  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );

  // Card layout config (unique to data_list)
  const cl = config.cardLayout ?? defaultCardLayout;
  const [titleColumn, setTitleColumn] = useState(cl.titleColumn);
  const [subtitleColumn, setSubtitleColumn] = useState(cl.subtitleColumn);
  const [headerBadgeColumns, setHeaderBadgeColumns] = useState<string[]>(
    cl.headerBadgeColumns
  );
  const [kpiColumns, setKpiColumns] = useState<string[]>(cl.kpiColumns);
  const [footerColumns, setFooterColumns] = useState<string[]>(
    cl.footerColumns
  );

  const [showExport, setShowExport] = useState(config.showExport ?? true);

  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );

  const autoPopulateCardLayout = (detected: { key: string }[]) => {
    const keys = detected.map((c) => c.key);
    setTitleColumn(keys[0] ?? "");
    setSubtitleColumn(keys[1] ?? "");
    setHeaderBadgeColumns(keys.length > 2 ? [keys[2]] : []);
    setKpiColumns(keys.slice(3, 9));
    setFooterColumns(keys.slice(9, 11));
  };

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    dataSourceId: dataSourceId || undefined,
    ...buildPgrestSettingsConfig(s),
    onDetectionComplete: autoPopulateCardLayout,
  });

  const schemaSuggestions = useSchemaSuggestions({
    dataMode: s.dataMode,
    rowsJson: s.rowsJson,
    sampleRows: pg.sampleRows,
    plannerVariableName,
  });

  const isDirty = useSettingsDirty(isOpen, {
    title: s.title,
    showRowCount: s.showRowCount,
    dataMode: s.dataMode,
    columns: s.columns,
    rowsJson: s.rowsJson,
    apiUrl: s.apiUrl,
    filterEnabled: s.filterEnabled,
    filterItems: s.filterItems,
    sortEnabled: s.sortEnabled,
    sortColumns: s.sortColumns,
    showExport,
    plannerVariableName,
    dataSourceId,
    titleColumn,
    subtitleColumn,
    headerBadgeColumns,
    kpiColumns,
    footerColumns,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    refreshValue: refresh.value,
  });

  const toggleList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    checked: boolean,
    key: string
  ) => {
    setter((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  const handleSave = () => {
    const rows = s.parseRows(
      tr("dashboard.settings.mustBeJsonArray", dictionary),
      tr("dashboard.settings.invalidJson", dictionary)
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
      showExport,
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
      plannerVariableName:
        s.dataMode === "planner" ? plannerVariableName : undefined,
      ...refresh.savePayload,
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

  const plannerContent = (
    <PlannerVariableSelector
      label={tr("dashboard.settings.plannerVariable", dictionary)}
      value={plannerVariableName}
      onChange={setPlannerVariableName}
      onSchemaDetected={(keys) =>
        syncColumnsFromKeys(keys, s, autoPopulateCardLayout)
      }
    />
  );

  const exportToggle = (
    <div className="flex items-center justify-between py-0.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {tr("dashboard.settings.showExport", dictionary)}
      </label>
      <input
        type="checkbox"
        checked={showExport}
        onChange={(e) => setShowExport(e.target.checked)}
        className="no-drag h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
      />
    </div>
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
          <Label
            htmlFor="dl-title-col"
            className="mb-1 block text-sm font-medium"
          >
            {tr("dashboard.settings.titleColumn", dictionary)}
          </Label>
          <Select
            id="dl-title-col"
            sizing="sm"
            value={titleColumn}
            onChange={(e) => setTitleColumn(e.target.value)}
            className="[&>select]:cursor-pointer"
          >
            <option value="">
              {tr("dashboard.settings.none", dictionary)}
            </option>
            {s.columnsWithKeys.map((c) => (
              <option key={c._id} value={c.key}>
                {c.label || c.key}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label
            htmlFor="dl-subtitle-col"
            className="mb-1 block text-sm font-medium"
          >
            {tr("dashboard.settings.subtitleColumn", dictionary)}
          </Label>
          <Select
            id="dl-subtitle-col"
            sizing="sm"
            value={subtitleColumn}
            onChange={(e) => setSubtitleColumn(e.target.value)}
            className="[&>select]:cursor-pointer"
          >
            <option value="">
              {tr("dashboard.settings.none", dictionary)}
            </option>
            {s.columnsWithKeys.map((c) => (
              <option key={c._id} value={c.key}>
                {c.label || c.key}
              </option>
            ))}
          </Select>
        </div>

        <CheckboxColumnList
          label={tr("dashboard.settings.headerBadgeColumns", dictionary)}
          columnsWithKeys={s.columnsWithKeys}
          selected={headerBadgeColumns}
          onToggle={(checked, key) =>
            toggleList(setHeaderBadgeColumns, checked, key)
          }
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
          onToggle={(checked, key) =>
            toggleList(setFooterColumns, checked, key)
          }
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
      plannerContent={plannerContent}
      handlebarsColorKeys
      schemaSuggestions={schemaSuggestions}
      filterSuggestions={filterSuggestions}
      refreshSelect={refresh.selectNode}
      title={dashletName}
      displayOptionsChildren={exportToggle}
      widgetId={widgetId}
      isDirty={isDirty}
    >
      {cardLayoutSection}
    </TableListSettingsShell>
  );
}
