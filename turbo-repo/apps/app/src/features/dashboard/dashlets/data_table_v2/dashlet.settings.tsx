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
import {
  ColumnEditor,
  RowActionsEditor,
} from "../common/settings-sections";
import { RowColorRuleSetter } from "../common/row-color-rule-setter";
import { SettingsTextField, SettingsToggleRow } from "../common/settings-fields";
import type { ColorRuleOperator } from "../common/color-rule-types";
import type { RowActionItemWithId } from "../common/action-helpers";
import {
  toRowActionItems,
  fromRowActionItems,
  normalizeRowActions,
} from "../common/action-helpers";
import { tr } from "@/features/i18n/tr.service";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";
import { SidebarSection } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/viewer/sidebar/sidebar-section";

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
  const [striped, setStriped] = useState(config.striped ?? false);
  const [rowActionItems, setRowActionItems] = useState<RowActionItemWithId[]>(
    () => toRowActionItems(normalizeRowActions(config.rowActions))
  );

  function addRowAction() {
    setRowActionItems((prev) => [
      ...prev,
      { _id: `ra-new-${Date.now()}`, method: "goto", name: "", link: "", target: "_self" },
    ]);
  }
  function removeRowAction(id: string) {
    setRowActionItems((prev) => prev.filter((a) => a._id !== id));
  }
  function updateRowAction(id: string, field: "name" | "link" | "target", value: string) {
    setRowActionItems((prev) =>
      prev.map((a) => (a._id === id ? { ...a, [field]: value } : a))
    );
  }

  const s = useSettingsState({
    title: config.title,
    defaultTitle: tr("dashlets.data_table_v2.name", dictionary),
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
    showColumnDividers,
    showExport,
    striped,
    rowActionItems,
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

    const { filter, sort, savedColumns, rowColorRules } =
      s.buildFilterSort();

    onSave({
      title: s.title,
      showRowCount: s.showRowCount,
      showColumnDividers,
      showExport,
      striped,
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
      rowActions: fromRowActionItems(rowActionItems),
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

  const operatorLabels: Record<ColorRuleOperator, string> = {
    equals: tr("dashboard.settings.operatorEquals", dictionary),
    not_equals: tr("dashboard.settings.operatorNotEquals", dictionary),
    contains: tr("dashboard.settings.operatorContains", dictionary),
    not_contains: tr("dashboard.settings.operatorNotContains", dictionary),
    greater_than: tr("dashboard.settings.operatorGreaterThan", dictionary),
    less_than: tr("dashboard.settings.operatorLessThan", dictionary),
    greater_than_or_equal: tr("dashboard.settings.operatorGreaterThanOrEqual", dictionary),
    less_than_or_equal: tr("dashboard.settings.operatorLessThanOrEqual", dictionary),
  };
  const valuePlaceholder = tr("dashboard.settings.value", dictionary);

  const visualizationTabContent = (
    <>
      <SidebarSection title="General" defaultExpanded>
        <div className="space-y-3">
          <SettingsTextField
            id="dt2-title"
            label={tr("common.title", dictionary)}
            value={s.title}
            onChange={s.setTitle}
          />
          <SettingsToggleRow
            label={tr("dashboard.settings.showRowCount", dictionary)}
            checked={s.showRowCount}
            onChange={s.setShowRowCount}
          />
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
          <SettingsToggleRow
            label={tr("dashboard.settings.striped", dictionary)}
            checked={striped}
            onChange={setStriped}
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Utilities" defaultExpanded>
        <div className="space-y-3">
          <div>
            <RowActionsEditor
              items={rowActionItems}
              onAdd={addRowAction}
              onRemove={removeRowAction}
              onReorder={setRowActionItems}
              onUpdate={updateRowAction}
              labels={{
                addAction: tr("dashboard.settings.addAction", dictionary),
                actionName: tr("dashboard.settings.actionName", dictionary),
                actionLink: tr("dashboard.settings.actionLink", dictionary),
                sameTab: tr("dashboard.settings.actionTargetSelf", dictionary),
                newTab: tr("dashboard.settings.actionTargetBlank", dictionary),
                primarySection: tr("dashboard.settings.primarySection", dictionary),
                secondarySection: tr("dashboard.settings.secondarySection", dictionary),
                dragActionHere: tr("dashboard.settings.dragActionHere", dictionary),
              }}
            />
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="Columns" defaultExpanded>
        <div className="space-y-3">
          <ColumnEditor
            columns={s.columns}
            onAdd={s.addColumn}
            onRemove={s.removeColumn}
            onReorder={s.setColumns}
            onUpdate={s.updateColumn}
            onAddColorMapping={s.addColorMapping}
            onRemoveColorMapping={s.removeColorMapping}
            onUpdateColorMapping={s.updateColorMapping}
            handlebarsColorKeys
            labels={{
              columns: tr("dashboard.settings.columns", dictionary),
              key: tr("dashboard.settings.key", dictionary),
              label: tr("dashboard.settings.label", dictionary),
              addColumn: tr("dashboard.settings.addColumn", dictionary),
              addMapping: tr("dashboard.settings.addRule", dictionary),
              stickyColumn: tr("dashboard.settings.stickyColumn", dictionary),
              rulesLabel: tr("dashboard.settings.colorRules", dictionary),
              valuePlaceholder,
              operatorLabels,
              decoratorPlaceholder: tr("dashboard.settings.decoratorPlaceholder", dictionary),
            }}
          />
        </div>
      </SidebarSection>

      <SidebarSection
        title="Coloring"
        defaultExpanded
        description={tr("dashboard.settings.rowColorRulesDescription", dictionary)}
      >
        <RowColorRuleSetter
          title={tr("dashboard.settings.rowColorRules", dictionary)}
          enabled={s.rowColorRuleItems.length > 0}
          onToggle={s.setRowColorRulesEnabled}
          rules={s.rowColorRuleItems}
          columns={s.columnsWithKeys}
          dictionary={dictionary}
          onAdd={s.addRowColorRule}
          onRemove={s.removeRowColorRule}
          onUpdate={s.updateRowColorRule}
          hideToggle
        />
      </SidebarSection>
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
      refreshSelect={refresh.selectNode}
      title={dashletName}
      widgetId={widgetId}
      isDirty={isDirty}
      visualizationTabContent={visualizationTabContent}
    />
  );
}
