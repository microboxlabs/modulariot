"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import type { useSettingsState } from "./use-settings-state";
import { SettingsTextField } from "./settings-fields";
import {
  ColumnEditor,
  FilterEditor,
  SortEditor,
  DataProviderTab,
} from "./settings-sections";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

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
  /** Enable Handlebars color coding on column key/label inputs */
  handlebarsColorKeys?: boolean;
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
  handlebarsColorKeys = false,
}: Readonly<TableListSettingsShellProps>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400",
    );

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-[28rem] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full max-h-[75vh] flex-col gap-3">
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
        <div className="flex-1 space-y-3 overflow-y-auto">
          {activeTab === "visualization" ? (
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
                handlebarsColorKeys={handlebarsColorKeys}
                labels={{
                  columns: tr("dashboard.settings.columns", dictionary),
                  key: tr("dashboard.settings.key", dictionary),
                  label: tr("dashboard.settings.label", dictionary),
                  addColumn: tr("dashboard.settings.addColumn", dictionary),
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
            </>
          ) : (
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
              labels={{
                dataSource: tr("dashboard.settings.dataSource", dictionary),
                staticJson: tr("dashboard.settings.staticJson", dictionary),
                dynamicApi: tr("dashboard.settings.dynamicApi", dictionary),
                pgrest: "PGREST",
                rowsJsonArray: tr("dashboard.settings.rowsJsonArray", dictionary),
                apiUrl: tr("dashboard.settings.apiUrl", dictionary),
              }}
            />
          )}
        </div>

        {/* Save button */}
        <Button
          onClick={onSave}
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
