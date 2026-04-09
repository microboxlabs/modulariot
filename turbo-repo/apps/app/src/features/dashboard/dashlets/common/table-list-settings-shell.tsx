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
  ColorRuleEditor,
  ActionsEditor,
  DataProviderTab,
} from "./settings-sections";
import { SettingsModalShell } from "./settings-modal-shell";
import type { ColorRuleOperator, RuleColor } from "./color-rule-types";

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

  const colorLabels: Record<RuleColor, string> = {
    red: tr("dashboard.settings.colorRed", dictionary),
    yellow: tr("dashboard.settings.colorYellow", dictionary),
    green: tr("dashboard.settings.colorGreen", dictionary),
    blue: tr("dashboard.settings.colorBlue", dictionary),
    gray: tr("dashboard.settings.colorGray", dictionary),
    orange: tr("dashboard.settings.colorOrange", dictionary),
    purple: tr("dashboard.settings.colorPurple", dictionary),
  };

  const valuePlaceholder = tr("dashboard.settings.value", dictionary);

  const visualizationTab = (
    <>
      <SettingsTextField
        id={`${id}-title`}
        label={tr("common.title", dictionary)}
        value={s.title}
        onChange={s.setTitle}
      />

      <div className="flex items-center justify-between py-0.5">
        <label className="text-sm font-medium">
          {tr("dashboard.settings.showRowCount", dictionary)}
        </label>
        <input
          type="checkbox"
          checked={s.showRowCount}
          onChange={(e) => s.setShowRowCount(e.target.checked)}
          className="no-drag h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
        />
      </div>

      <ColumnEditor
        columns={s.columns}
        onAdd={s.addColumn}
        onRemove={s.removeColumn}
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
          valuePlaceholder,
          operatorLabels,
          colorLabels,
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

      <ColorRuleEditor
        title={tr("dashboard.settings.rowColorRules", dictionary)}
        enabled={s.rowColorRulesEnabled}
        onToggle={s.setRowColorRulesEnabled}
        rules={s.rowColorRuleItems}
        columnsWithKeys={s.columnsWithKeys}
        onAdd={s.addRowColorRule}
        onRemove={s.removeRowColorRule}
        onUpdate={s.updateRowColorRule}
        labels={{
          addRule: tr("dashboard.settings.addRule", dictionary),
          valuePlaceholder,
          operatorLabels,
          colorLabels,
        }}
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
    </>
  );

  const dataTab = (
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
  );

  return (
    <SettingsModalShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      dictionary={dictionary}
      visualizationTab={visualizationTab}
      dataTab={dataTab}
      className="w-[28rem]"
      refreshSelect={refreshSelect}
      title={title}
    />
  );
}
