"use client";

import type { ReactNode } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { useSettingsState } from "./use-settings-state";
import { SettingsTextField } from "./settings-fields";
import {
  ColumnEditor,
  FilterEditor,
  SortEditor,
  ActionsEditor,
  DataProviderTab,
} from "./settings-sections";
import { SettingsShell } from "./settings-shell";
import { RowColorRuleSetter } from "./row-color-rule-setter";
import type { ColorRuleOperator } from "./color-rule-types";

// ============================================================================
// Types
// ============================================================================

interface TableListSettingsShellProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  state: ReturnType<typeof useSettingsState>;
  dictionary: I18nRecord;
  /** Extra sections inserted between ColumnEditor and FilterEditor */
  children?: ReactNode;
  /** Content rendered inside the data provider tab when dataMode === "pgrest" */
  dataTabChildren?: ReactNode;
  /** Content rendered inside the data provider tab when dataMode === "planner" */
  plannerContent?: ReactNode;
  /** Enable Handlebars color coding on column key/label inputs */
  handlebarsColorKeys?: boolean;
  /** Optional refresh interval select rendered above the save button */
  refreshSelect?: ReactNode;
  /** Optional title shown in the modal header */
  title?: string;
  /** Additional display options rendered next to "Row count" toggle */
  displayOptionsChildren?: ReactNode;
  /** Widget ID for anchor navigation */
  widgetId?: string;
  /** Whether the settings form has unsaved changes */
  isDirty: boolean;
  /** When provided, replaces the entire flat visualization tab content */
  visualizationTabContent?: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function TableListSettingsShell({
  id,
  isOpen,
  onClose,
  onSave,
  state: s,
  dictionary,
  children,
  dataTabChildren,
  plannerContent,
  handlebarsColorKeys = false,
  refreshSelect,
  title,
  displayOptionsChildren,
  widgetId,
  isDirty,
  visualizationTabContent,
}: Readonly<TableListSettingsShellProps>) {
  const operatorLabels: Record<ColorRuleOperator, string> = {
    equals: tr("dashboard.settings.operatorEquals", dictionary),
    not_equals: tr("dashboard.settings.operatorNotEquals", dictionary),
    contains: tr("dashboard.settings.operatorContains", dictionary),
    not_contains: tr("dashboard.settings.operatorNotContains", dictionary),
    greater_than: tr("dashboard.settings.operatorGreaterThan", dictionary),
    less_than: tr("dashboard.settings.operatorLessThan", dictionary),
    greater_than_or_equal: tr(
      "dashboard.settings.operatorGreaterThanOrEqual",
      dictionary
    ),
    less_than_or_equal: tr(
      "dashboard.settings.operatorLessThanOrEqual",
      dictionary
    ),
  };

  const valuePlaceholder = tr("dashboard.settings.value", dictionary);

  const visualizationTab = visualizationTabContent ?? (
    <div className="p-4">
      <SettingsTextField
        id={`${id}-title`}
        label={tr("common.title", dictionary)}
        value={s.title}
        onChange={s.setTitle}
      />

      <div className="flex items-center justify-between py-0.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {tr("dashboard.settings.showRowCount", dictionary)}
        </label>
        <input
          type="checkbox"
          checked={s.showRowCount}
          onChange={(e) => s.setShowRowCount(e.target.checked)}
          className="no-drag h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
        />
      </div>

      {displayOptionsChildren}

      <ColumnEditor
        columns={s.columns}
        onAdd={s.addColumn}
        onRemove={s.removeColumn}
        onReorder={s.setColumns}
        onUpdate={s.updateColumn}
        onAddColorMapping={s.addColorMapping}
        onRemoveColorMapping={s.removeColorMapping}
        onUpdateColorMapping={s.updateColorMapping}
        handlebarsColorKeys={handlebarsColorKeys}
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
        }}
      />

      {children}

      <FilterEditor
        enabled={s.filterEnabled}
        onToggle={s.setFilterEnabled}
        items={s.filterItems}
        columnsWithKeys={s.columnsWithKeys}
        onAdd={s.addFilterItem}
        onRemove={s.removeFilterItem}
        onUpdate={s.updateFilterItem}
        labels={{
          filter: tr("dashboard.settings.filter", dictionary),
          filterRows: tr("dashboard.settings.filterRows", dictionary),
          label: tr("dashboard.settings.label", dictionary),
          addFilter: tr("dashboard.settings.addFilter", dictionary),
        }}
      />

      <SortEditor
        enabled={s.sortEnabled}
        onToggle={s.setSortEnabled}
        sortColumns={s.sortColumns}
        columnsWithKeys={s.columnsWithKeys}
        onColumnToggle={s.handleSortColumnToggle}
        labels={{
          sort: tr("dashboard.settings.sort", dictionary),
          sortableColumns: tr("dashboard.settings.sortableColumns", dictionary),
        }}
      />

      <RowColorRuleSetter
        title={tr("dashboard.settings.rowColorRules", dictionary)}
        enabled={s.rowColorRulesEnabled}
        onToggle={s.setRowColorRulesEnabled}
        rules={s.rowColorRuleItems}
        columns={s.columnsWithKeys}
        dictionary={dictionary}
        onAdd={s.addRowColorRule}
        onRemove={s.removeRowColorRule}
        onUpdate={s.updateRowColorRule}
      />

      <ActionsEditor
        enabled={s.actionsEnabled}
        onToggle={s.setActionsEnabled}
        items={s.actionItems}
        onAdd={s.addAction}
        onRemove={s.removeAction}
        onUpdate={s.updateAction}
        labels={{
          actions: tr("dashboard.settings.actions", dictionary),
          addAction: tr("dashboard.settings.addAction", dictionary),
          actionName: tr("dashboard.settings.actionName", dictionary),
          actionLink: tr("dashboard.settings.actionLink", dictionary),
          actionTarget: tr("dashboard.settings.actionTarget", dictionary),
          actionTargetSelf: tr(
            "dashboard.settings.actionTargetSelf",
            dictionary
          ),
          actionTargetBlank: tr(
            "dashboard.settings.actionTargetBlank",
            dictionary
          ),
        }}
      />
    </div>
  );

  const dataTab = (
    <div className="p-4">
      <DataProviderTab
        id={id}
        dataMode={s.dataMode}
        onDataModeChange={s.setDataMode}
        rowsJson={s.rowsJson}
        onRowsJsonChange={s.setRowsJson}
        rowsJsonError={s.rowsJsonError}
        onRowsJsonErrorClear={() => s.setRowsJsonError(null)}
        apiUrl={s.apiUrl}
        onApiUrlChange={s.setApiUrl}
        pgrestContent={dataTabChildren}
        plannerContent={plannerContent}
        labels={{
          dataSource: tr("dashboard.settings.dataSource", dictionary),
          staticJson: tr("dashboard.settings.staticJson", dictionary),
          dynamicApi: tr("dashboard.settings.dynamicApi", dictionary),
          pgrest: "PGREST",
          planner: tr("dashboard.settings.planner", dictionary),
          rowsJsonArray: tr("dashboard.settings.rowsJsonArray", dictionary),
          apiUrl: tr("dashboard.settings.apiUrl", dictionary),
        }}
      />
    </div>
  );

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      dictionary={dictionary}
      tabs={[
        {
          id: "visualization",
          label: tr("dashboard.settings.visualization", dictionary),
          content: visualizationTab,
        },
        {
          id: "data",
          label: tr("dashboard.settings.dataProvider", dictionary),
          content: dataTab,
        },
      ]}
      className="w-[28rem]"
      contentClassName=""
      footer={refreshSelect}
      title={title}
      widgetId={widgetId}
      isDirty={isDirty}
    />
  );
}
