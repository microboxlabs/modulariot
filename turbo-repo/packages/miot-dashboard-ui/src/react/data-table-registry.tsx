"use client";
import { useMemo } from "react";
import { buildCsvContent } from "../core/export-csv";
import { downloadCsv } from "./download-csv";
import { createWidgetRegistry } from "../core/widget-registry";
import { createTemplateEngine } from "../templates";
import {
  normalizeActionsConfig,
  normalizeRowActions,
  isSafeActionUrl,
} from "../core/action-helpers";
import { evaluateRule } from "../core/color-rules";
import type { ColumnFilter } from "../core/column-filter-types";
import { tableWidgetConfig } from "./table-widget-config";
import { useOptionalPlannerContext } from "./planner-results";
import { useCompiledColumns } from "./use-compiled-columns";
import { useFilterAndSort } from "./use-filter-and-sort";
import { useColumnFilters } from "./use-column-filters";
import { FilterPillRow, SortPillRow } from "./row-controls";
import { ColumnFilterToolbar } from "./column-filter-toolbar";
import { ColumnFilterPopover } from "./column-filter-popover";
import type { ColumnFilterInputLabels } from "./column-filter-input";
import { DataTable } from "./data-table";
import { ActionDropdown } from "./action-dropdown";
import type { WidgetComponentProps } from "./widget-renderer";

export interface DataTableRegistryOptions {
  defaultTitle: string;
  /** Omit to hide export controls. */
  exportLabel?: string;
  onExportCsv?: (content: string, filename: string) => void;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  emptyLabel: string;
  actionsLabel: string;
  allLabel: string;
  sortLabel: string;
  clearFilterLabel: string;
  clearAllLabel: string;
  directionLabels: { asc: string; desc: string };
  filterLabels: ColumnFilterInputLabels;
  filterTitle: (column: string) => string;
  filterSummary: (filtered: number, total: number) => string;
  removeFilterLabel: (label: string) => string;
  formatFilterValue: (filter: ColumnFilter) => string;
  rowCountLabel: (count: number) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
export function createDataTableRegistry(
  options: Readonly<DataTableRegistryOptions>,
) {
  return createTableRegistry(options, "data_table");
}
export interface ResizableDataTableRegistryOptions extends DataTableRegistryOptions {
  resizeLabel: (column: string) => string;
}
export function createResizableDataTableRegistry(
  options: Readonly<ResizableDataTableRegistryOptions>,
) {
  return createTableRegistry(options, "data_table_v2", options.resizeLabel);
}
function createTableRegistry(
  options: Readonly<DataTableRegistryOptions>,
  type: "data_table" | "data_table_v2",
  resizeLabel?: (column: string) => string,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredDataTable({ widget }: Readonly<WidgetComponentProps>) {
    const parsed = useMemo(
      () => tableWidgetConfig.safeParse(widget.config),
      [widget.config],
    );
    if (!parsed.success) return <p role="alert">{options.errorLabel}</p>;
    return (
      <BoundTable
        key={`${widget.id}:${parsed.data.dataMode}:${parsed.data.plannerVariableName ?? ""}`}
        config={parsed.data}
      />
    );
  }
  function BoundTable({
    config,
  }: Readonly<{ config: ReturnType<typeof tableWidgetConfig.parse> }>) {
    const { results, definitions } = useOptionalPlannerContext();
    const result =
      config.dataMode === "planner" && config.plannerVariableName
        ? results.get(config.plannerVariableName)
        : undefined;
    const loading =
      config.dataMode === "planner" &&
      (Boolean(result?.loading) ||
        (!result &&
          definitions.some(
            (d) => d.variableName === config.plannerVariableName,
          )));
    const failed =
      config.dataMode === "planner" &&
      !loading &&
      (!result || Boolean(result.error));
    const unsupported =
      config.dataMode !== "static" && config.dataMode !== "planner";
    const rows = useMemo(() => {
      if (loading || failed || unsupported) return [];
      if (config.dataMode === "planner") return result?.rows ?? [];
      return config.rows;
    }, [config, loading, failed, unsupported, result]);
    const rowControls = useFilterAndSort(
      config.filter,
      resizeLabel
        ? { enabled: true, columns: config.columns.map((column) => column.key) }
        : config.sort,
      rows,
      config.columns,
    );
    const filters = useColumnFilters(rowControls.displayRows, config.columns);
    const { resolveValue, resolveLabel, resolveType } = useCompiledColumns(
      config.columns,
      filters.filteredCount,
      { templateEngine: engine },
    );
    const actions = useMemo(
      () =>
        normalizeActionsConfig(config.actions, { enabled: false, items: [] }),
      [config.actions],
    );
    const links = useMemo(
      () =>
        engine.compileTemplates(
          actions.items.map((action, index) => ({
            id: String(index),
            template: action.link,
          })),
        ),
      [actions],
    );
    const rowActions = useMemo(
      () => normalizeRowActions(config.rowActions),
      [config.rowActions],
    );
    const rowLinks = useMemo(
      () =>
        engine.compileTemplates(
          rowActions.map((action, index) => ({
            id: String(index),
            template: action.link,
          })),
        ),
      [rowActions],
    );
    const titleTemplate = useMemo(
      () => engine.compileTemplates([{ id: "title", template: config.title }]),
      [config.title],
    );
    const title =
      engine.resolveTemplate(
        titleTemplate,
        "title",
        { _count: filters.filteredCount },
        config.title || options.defaultTitle,
      ) || options.defaultTitle;
    if (loading) return <output>{options.loadingLabel}</output>;
    if (failed) return <p role="alert">{options.errorLabel}</p>;
    if (unsupported) return <p role="alert">{options.unsupportedDataLabel}</p>;
    return (
      <div className="miot-table-widget">
        <header>
          <strong>{title}</strong>
          {config.showExport &&
            options.exportLabel &&
            filters.filteredCount > 0 && (
              <button
                type="button"
                className="miot-row-controls__pill"
                onClick={() => {
                  const csv = buildCsvContent(
                    config.columns,
                    filters.filteredData,
                    resolveValue,
                    resolveLabel,
                  );
                  (options.onExportCsv ?? downloadCsv)(csv, `${title}.csv`);
                }}
              >
                {options.exportLabel}
              </button>
            )}
          {config.showRowCount && (
            <span>{options.rowCountLabel(filters.filteredCount)}</span>
          )}
        </header>
        {config.filter.enabled &&
          config.filter.items.map((item, index) => (
            <FilterPillRow
              key={`${item.column}-${index}`}
              item={item}
              options={rowControls.filterOptionsByColumn[item.column] ?? []}
              selected={rowControls.filterValues[item.column] ?? ""}
              allLabel={options.allLabel}
              onClear={rowControls.handleFilterClear}
              onSelect={rowControls.handleFilterSelect}
            />
          ))}
        {config.sort.enabled && (
          <SortPillRow
            label={options.sortLabel}
            columns={rowControls.validSortColumns}
            sortKey={rowControls.sortKey}
            sortDir={rowControls.sortDir}
            directionLabels={options.directionLabels}
            getColumnLabel={rowControls.getColumnLabel}
            onSortClick={rowControls.handleSortClick}
          />
        )}
        <ColumnFilterToolbar
          filters={filters.filters}
          columns={config.columns}
          summary={options.filterSummary(
            filters.filteredCount,
            filters.totalCount,
          )}
          clearAllLabel={options.clearAllLabel}
          removeLabel={options.removeFilterLabel}
          formatValue={options.formatFilterValue}
          onRemove={filters.removeFilter}
          onClearAll={filters.clearAllFilters}
        />
        <DataTable
          striped={config.striped}
          resizing={
            resizeLabel
              ? { savedWidths: config.columnWidths, handleLabel: resizeLabel }
              : undefined
          }
          rowActions={
            rowActions.length
              ? (row) =>
                  rowActions.map((action, index) => ({
                    action,
                    href: engine.resolveTemplate(
                      rowLinks,
                      String(index),
                      { ...row, row },
                      action.link,
                    ),
                  }))
              : undefined
          }
          columns={config.columns}
          rows={filters.filteredData}
          label={title}
          emptyLabel={options.emptyLabel}
          loadingLabel={options.loadingLabel}
          actionsLabel={options.actionsLabel}
          showColumnDividers={config.showColumnDividers}
          resolveValue={resolveValue}
          resolveLabel={resolveLabel}
          resolveType={resolveType}
          renderHeader={(column, label) => (
            <div className="miot-table-widget__heading">
              {resizeLabel ? (
                <button
                  type="button"
                  title={
                    column.descriptionEnabled ? column.description : undefined
                  }
                  onClick={() => rowControls.handleSortClick(column.key)}
                >
                  {label}
                  {rowControls.sortKey === column.key && (
                    <span
                      aria-label={options.directionLabels[rowControls.sortDir]}
                    >
                      {rowControls.sortDir === "asc" ? " ↓" : " ↑"}
                    </span>
                  )}
                </button>
              ) : (
                <span
                  title={
                    column.descriptionEnabled ? column.description : undefined
                  }
                >
                  {label}
                </span>
              )}
              <ColumnFilterPopover
                title={options.filterTitle(label)}
                clearLabel={options.clearFilterLabel}
                labels={options.filterLabels}
                columnKey={column.key}
                dataType={filters.resolvedDataTypes[column.key] ?? "text"}
                currentFilter={filters.filters[column.key]}
                enumValues={filters.enumValues[column.key] ?? []}
                onFilterChange={filters.setFilter}
              />
            </div>
          )}
          rowColor={(row, index) =>
            config.rowColorRules?.enabled
              ? (config.rowColorRules.rules.find((rule) =>
                  evaluateRule(
                    rule,
                    resolveValue(
                      rule.column,
                      row,
                      index,
                      filters.filteredCount,
                    ),
                  ),
                )?.color ?? null)
              : null
          }
          renderActions={
            actions.enabled && actions.items.length
              ? (row) => (
                  <ActionDropdown
                    ariaLabel={options.actionsLabel}
                    items={actions.items.flatMap((action, index) => {
                      const href = engine.resolveTemplate(
                        links,
                        String(index),
                        { ...row, row },
                        action.link,
                      );
                      return isSafeActionUrl(href) ? [{ action, href }] : [];
                    })}
                  />
                )
              : undefined
          }
        />
      </div>
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: type, hasChildren: false, hasSettings: false },
      Component: RegisteredDataTable,
      getLayoutDefaults: () => ({ minW: 4, minH: 3 }),
    },
  ]);
}
