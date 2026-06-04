"use client";

import { useState } from "react";
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
import { useWidgetRefreshSettings } from "../common/use-widget-refresh-settings";
import { useSettingsDirty } from "../common/use-settings-dirty";
import { fromPgrestParamItems } from "../common/pgrest-types";
import {
  buildPgrestSettingsConfig,
  buildPgrestContentLabels,
  syncColumnsFromKeys,
} from "../common/pgrest-settings-helpers";
import { PlannerVariableSelector } from "../common/planner-variable-selector";
import { tr } from "@/features/i18n/tr.service";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";
import { HbTextField, SettingsToggleRow } from "../common/settings-fields";
import { Select } from "flowbite-react";

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
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);

  const activeProviders = dataSources.filter(
    (ds) => ds.isActive === true && ds.lastTestResult === true
  );

  const [dataSourceId, setDataSourceId] = useState<string>(
    config.dataSourceId ?? ""
  );
  const [plannerVariableName, setPlannerVariableName] = useState(
    config.plannerVariableName ?? ""
  );
  const [showColumnDividers, setShowColumnDividers] = useState(
    config.showColumnDividers ?? true
  );
  const [showExport, setShowExport] = useState(config.showExport ?? true);
  const [rowClickEnabled, setRowClickEnabled] = useState(config.rowClickEnabled ?? false);
  const [rowClickLink, setRowClickLink] = useState(config.rowClickLink ?? "");
  const [rowClickTarget, setRowClickTarget] = useState<"_self" | "_blank">(config.rowClickTarget ?? "_self");

  const s = useSettingsState({
    title: config.title,
    defaultTitle: "Data Table V2",
    showRowCount: config.showRowCount,
    columns: config.columns,
    defaultColumns,
    rows: config.rows,
    defaultRows,
    filter: config.filter,
    defaultFilter,
    sort: config.sort,
    defaultSort,
    dataMode:
      config.dataMode === "pgrest" ? "pgrest" : (config.dataMode ?? "static"),
    apiUrl: "",
    rowColorRules: config.rowColorRules,
    actions: config.actions,
  });

  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    dataSourceId: dataSourceId || undefined,
    ...buildPgrestSettingsConfig(s),
  });

  const isDirty = useSettingsDirty(isOpen, {
    title: s.title,
    showRowCount: s.showRowCount,
    dataMode: s.dataMode,
    columns: s.columns,
    rowsJson: s.rowsJson,
    filterEnabled: s.filterEnabled,
    filterItems: s.filterItems,
    sortEnabled: s.sortEnabled,
    sortColumns: s.sortColumns,
    rowColorRulesEnabled: s.rowColorRulesEnabled,
    rowColorRuleItems: s.rowColorRuleItems,
    actionsEnabled: s.actionsEnabled,
    actionItems: s.actionItems,
    showColumnDividers,
    showExport,
    rowClickEnabled,
    rowClickLink,
    rowClickTarget,
    dataSourceId,
    plannerVariableName,
    pgFn: pg.pgrestFunctionName,
    pgParams: pg.pgrestParams,
    pgMethod: pg.pgrestHttpMethod,
    refreshValue: refresh.value,
  });

  const handleSave = () => {
    const rows = s.parseRows(
      tr("dashboard.settings.mustBeJsonArray", dictionary),
      tr("dashboard.settings.invalidJson", dictionary)
    );
    if (!rows) return;

    const { filter, sort, savedColumns, rowColorRules, actions } =
      s.buildFilterSort();

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      showColumnDividers,
      showExport,
      rowClickEnabled,
      rowClickLink: rowClickEnabled ? rowClickLink : undefined,
      rowClickTarget: rowClickEnabled ? rowClickTarget : undefined,
      dataMode: s.dataMode as "static" | "pgrest" | "planner",
      columns: savedColumns,
      rows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      filter,
      sort,
      dataSourceId: dataSourceId || undefined,
      plannerVariableName:
        s.dataMode === "planner" ? plannerVariableName : undefined,
      rowColorRules,
      actions,
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
      onSchemaDetected={(keys) => syncColumnsFromKeys(keys, s)}
    />
  );

  const displayOptions = (
    <>
      <SettingsToggleRow
        label={tr("dashboard.settings.showColumnDividers", dictionary)}
        checked={showColumnDividers}
        onChange={setShowColumnDividers}
      />
      <SettingsToggleRow
        label={tr("dashboard.settings.showExport", dictionary)}
        checked={showExport}
        onChange={setShowExport}
      />

      {/* Row click action */}
      <hr className="border-gray-200 dark:border-gray-700" />
      <SettingsToggleRow
        label="Row click action"
        checked={rowClickEnabled}
        onChange={setRowClickEnabled}
      />
      {rowClickEnabled && (
        <div className="space-y-2 pt-1">
          <HbTextField
            id="row-click-link"
            label="URL"
            placeholder="https://example.com/{{row.id}}"
            value={rowClickLink}
            onChange={setRowClickLink}
            schemaSuggestions={s.columns.map((c) => c.key)}
          />
          <Select
            sizing="sm"
            value={rowClickTarget}
            onChange={(e) => setRowClickTarget(e.target.value as "_self" | "_blank")}
          >
            <option value="_self">Same tab</option>
            <option value="_blank">New tab</option>
          </Select>
        </div>
      )}
    </>
  );

  return (
    <TableListSettingsShell
      id="dt2"
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      state={s}
      dictionary={dictionary}
      dataTabChildren={pgrestContent}
      plannerContent={plannerContent}
      handlebarsColorKeys
      refreshSelect={refresh.selectNode}
      title={dashletName}
      displayOptionsChildren={displayOptions}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
