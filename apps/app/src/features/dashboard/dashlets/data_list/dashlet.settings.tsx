"use client";

import { useState } from "react";
import { Button, Label, Select } from "flowbite-react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
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
import {
  ColumnEditor,
  FilterEditor,
  SortEditor,
  DataProviderTab,
  CheckboxColumnList,
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

  // Card layout config
  const cl = config.cardLayout ?? defaultCardLayout;
  const [titleColumn, setTitleColumn] = useState(cl.titleColumn);
  const [subtitleColumn, setSubtitleColumn] = useState(cl.subtitleColumn);
  const [headerBadgeColumns, setHeaderBadgeColumns] = useState<string[]>(
    cl.headerBadgeColumns,
  );
  const [kpiColumns, setKpiColumns] = useState<string[]>(cl.kpiColumns);
  const [footerColumns, setFooterColumns] = useState<string[]>(
    cl.footerColumns,
  );

  const handleCheckboxListToggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    checked: boolean,
    key: string,
  ) => {
    setter((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );
  };

  // ── Save ────────────────────────────────────────────────────────────────────

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
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
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
                id="dl-title"
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

              {/* ── Card Layout ─────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <Label className="text-sm font-semibold">{tr("dashboard.settings.cardLayout", dictionary)}</Label>

                <div>
                  <Label htmlFor="dl-title-col" className="mb-1 block text-sm font-medium">
                    {tr("dashboard.settings.titleColumn", dictionary)}
                  </Label>
                  <Select
                    id="dl-title-col"
                    sizing="sm"
                    value={titleColumn}
                    onChange={(e) => setTitleColumn(e.target.value)}
                  >
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
                  <Select
                    id="dl-subtitle-col"
                    sizing="sm"
                    value={subtitleColumn}
                    onChange={(e) => setSubtitleColumn(e.target.value)}
                  >
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
                  onToggle={(checked, key) =>
                    handleCheckboxListToggle(setHeaderBadgeColumns, checked, key)
                  }
                />

                <CheckboxColumnList
                  label={tr("dashboard.settings.kpiGridColumns", dictionary)}
                  columnsWithKeys={s.columnsWithKeys}
                  selected={kpiColumns}
                  onToggle={(checked, key) =>
                    handleCheckboxListToggle(setKpiColumns, checked, key)
                  }
                />

                <CheckboxColumnList
                  label={tr("dashboard.settings.footerColumns", dictionary)}
                  columnsWithKeys={s.columnsWithKeys}
                  selected={footerColumns}
                  onToggle={(checked, key) =>
                    handleCheckboxListToggle(setFooterColumns, checked, key)
                  }
                />
              </div>

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
              id="dl"
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
