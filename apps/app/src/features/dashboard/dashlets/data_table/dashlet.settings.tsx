"use client";

import { useState } from "react";
import { Button } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultFilter,
} from "./dashlet";
import { useSettingsState } from "../common/use-settings-state";
import {
  ColumnEditor,
  FilterEditor,
  SortEditor,
  DataProviderTab,
} from "../common/settings-sections";
import { SettingsTextField } from "../common/settings-fields";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

// ============================================================================
// Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

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

  // ── Save ────────────────────────────────────────────────────────────────────

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

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
    );

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-3 max-h-[75vh]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("visualization")}
            className={tabClass("visualization")}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={tabClass("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeTab === "visualization" ? (
            <>
              <SettingsTextField
                id="dt-title"
                label={tr("common.title", dictionary)}
                value={s.title}
                onChange={s.setTitle}
              />

              <div className="flex items-center justify-between py-0.5">
                <label className="text-sm font-medium">{tr("dashboard.settings.showRowCount", dictionary)}</label>
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
                labels={{
                  columns: tr("dashboard.settings.columns", dictionary),
                  key: tr("dashboard.settings.key", dictionary),
                  label: tr("dashboard.settings.label", dictionary),
                  addColumn: tr("dashboard.settings.addColumn", dictionary),
                }}
              />

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
            </>
          ) : (
            <DataProviderTab
              id="dt"
              dataMode={s.dataMode}
              onDataModeChange={s.setDataMode}
              rowsJson={s.rowsJson}
              onRowsJsonChange={s.setRowsJson}
              rowsJsonError={s.rowsJsonError}
              onRowsJsonErrorClear={() => s.setRowsJsonError(null)}
              apiUrl={s.apiUrl}
              onApiUrlChange={s.setApiUrl}
              labels={{
                dataSource: tr("dashboard.settings.dataSource", dictionary),
                staticJson: tr("dashboard.settings.staticJson", dictionary),
                dynamicApi: tr("dashboard.settings.dynamicApi", dictionary),
                rowsJsonArray: tr("dashboard.settings.rowsJsonArray", dictionary),
                apiUrl: tr("dashboard.settings.apiUrl", dictionary),
              }}
            />
          )}
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          onMouseDown={handleMouseDown}
          size="sm"
          className="no-drag w-full shrink-0"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
