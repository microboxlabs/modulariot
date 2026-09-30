"use client";
import { DataTable } from "@microboxlabs/miot-dashboard-ui/react";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
} from "@/features/dashboard/dashlets/types";
import type {
  TableColumn,
  SortConfig,
} from "@/features/dashboard/dashlets/common/column-types";
import type { FilterConfig } from "@/features/dashboard/dashlets/common/filter-types";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
import { useFilterAndSort } from "@/features/dashboard/dashlets/common/use-filter-and-sort";
import { useColumnFilters } from "@/features/dashboard/dashlets/common/use-column-filters";
import { ColumnFilterPopover } from "@/features/dashboard/dashlets/common/column-filter-popover";
import { ColumnFilterToolbar } from "@/features/dashboard/dashlets/common/column-filter-toolbar";
import { useDashletData } from "@/features/dashboard/dashlets/common/use-dashlet-data";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useCompiledColumns } from "@/features/dashboard/dashlets/common/use-compiled-columns";
import { useOptionalDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import Markdown from "react-markdown";

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ColumnType,
  DataType,
  TableColumn,
  SortConfig,
} from "@/features/dashboard/dashlets/common/column-types";
export type {
  FilterItemConfig,
  FilterConfig,
} from "@/features/dashboard/dashlets/common/filter-types";
export type {
  PgrestParam,
  PgrestHttpMethod,
} from "@/features/dashboard/dashlets/common/pgrest-types";
export { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
export { resolveDataProperty } from "@/features/dashboard/dashlets/common/handlebars-helpers";

import type {
  PgrestParam,
  PgrestHttpMethod,
} from "@/features/dashboard/dashlets/common/pgrest-types";
import type { ColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-types";
import { findMatchingColor } from "@/features/dashboard/dashlets/common/color-rule-engine";
import { normalizeColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-helpers";
import type {
  ActionsConfig,
  RowAction,
} from "@/features/dashboard/dashlets/common/action-types";
import {
  normalizeActionsConfig,
  normalizeRowActions,
} from "@/features/dashboard/dashlets/common/action-helpers";
import { resolveHandlebarsField } from "@/features/dashboard/dashlets/common/use-handlebars-templates";
import { tableStatusLabels, tableRowActions } from "../common/table-host-adapters";
import {
  DashletTitleBar,
  buildTitleBarData,
} from "@/features/dashboard/dashlets/common/dashlet-title-bar";

// ============================================================================
// Config & Defaults
// ============================================================================

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  /** Show dim vertical dividers between table columns */
  showColumnDividers?: boolean;
  /**
   * Column widths in px, keyed by column key. Set by resizing columns in edit
   * mode and shared by all users; view-mode resizes stay local to the viewer.
   * The last column is never stored — it always fills the remaining space.
   */
  columnWidths?: Record<string, number>;
  dataMode: "static" | "pgrest" | "planner";
  columns: TableColumn[];
  rows: Record<string, string>[];
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  filter: FilterConfig;
  sort: SortConfig;
  dataSourceId?: string;
  plannerVariableName?: string;
  rowColorRules?: ColorRulesConfig;
  actions?: ActionsConfig;
  /** Unified row actions: first = left-click, rest = right-click context menu */
  rowActions?: RowAction[];
  /** Show the export dropdown in the title bar */
  showExport?: boolean;
  /** Alternate row background colors */
  striped?: boolean;
  /** @deprecated use rowActions instead */
  rowClickEnabled?: boolean;
  /** @deprecated use rowActions instead */
  rowClickLink?: string;
  /** @deprecated use rowActions instead */
  rowClickTarget?: "_self" | "_blank";
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultColumns: TableColumn[] = [
  { key: "{{row.vehicle}}", label: "Vehículo", type: "text" },
  { key: "{{row.client}}", label: "Cliente", type: "text" },
  { key: "{{row.km}}", label: "KM Totales", type: "highlight" },
  { key: "{{row.system}}", label: "Sistema", type: "text" },
  { key: "{{row.status}}", label: "Estado", type: "badge" },
  { key: "{{row.alert}}", label: "Tipo de Alerta", type: "text" },
  { key: "{{row.duration}}", label: "Duración", type: "text" },
];

export const defaultRows: Record<string, string>[] = [
  {
    vehicle: "FL-2341\nPeugeot Partner",
    client: "Traza Logistics",
    km: "47,400 km",
    system: "DPF",
    status: "Crítico",
    alert: "Saturación DPF crítica",
    duration: "12 días",
  },
  {
    vehicle: "FL-1892\nMercedes Vito",
    client: "Logística Express",
    km: "38,900 km",
    system: "Motor",
    status: "Crítico",
    alert: "Temperatura elevada",
    duration: "8 días",
  },
  {
    vehicle: "FL-3456\nMitsubishi L200",
    client: "Constructora Andina S.A.",
    km: "61,200 km",
    system: "DPF",
    status: "Crítico",
    alert: "Presión diferencial alta",
    duration: "5 días",
  },
  {
    vehicle: "FL-4521\nVolkswagen Amarok",
    client: "Distribuciones FastGo",
    km: "23,400 km",
    system: "Alimentación",
    status: "Medio",
    alert: "Presión de combustible baja",
    duration: "3 días",
  },
];

export const defaultFilter: FilterConfig = {
  enabled: true,
  items: [{ column: "{{row.status}}", label: "Estado:" }],
};

export const defaultSort: SortConfig = {
  enabled: true,
  columns: ["{{row.status}}", "{{row.system}}", "{{row.duration}}"],
};

export const defaultConfig: DashletConfig & Record<string, unknown> = {
  title: "Data Table V2",
  showRowCount: true,
  showColumnDividers: true,
  dataMode: "static",
  columns: defaultColumns,
  rows: defaultRows,
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  filter: defaultFilter,
  sort: defaultSort,
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 7,
  minH: 6,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Markdown tooltip (portal-based to escape overflow containers)
// ============================================================================

interface MarkdownTooltipProps {
  description: string;
  children: React.ReactNode;
}

function MarkdownTooltip({
  description,
  children,
}: Readonly<MarkdownTooltipProps>) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const coordsRef = useRef({ top: 0, left: 0 });

  function show() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    coordsRef.current = {
      top: rect.bottom,
      left: rect.left + rect.width / 2,
    };
    setVisible(true);
  }

  function hide() {
    hideTimer.current = setTimeout(() => {
      setVisible(false);
    }, 150);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const clampToViewport = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const { top, left } = coordsRef.current;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    const rect = el.getBoundingClientRect();
    const pad = 8;

    const halfW = rect.width / 2;
    let clampedLeft = left;
    if (left - halfW < pad) {
      clampedLeft = halfW + pad;
    } else if (left + halfW > window.innerWidth - pad) {
      clampedLeft = window.innerWidth - pad - halfW;
    }

    let clampedTop = top;
    if (top + rect.height > window.innerHeight - pad) {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) {
        clampedTop = triggerRect.top - rect.height;
      }
    }

    el.style.top = `${clampedTop}px`;
    el.style.left = `${clampedLeft}px`;
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        tabIndex={0}
        role="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={clampToViewport}
            role="tooltip"
            className="fixed z-9999 w-max max-w-sm pt-1"
            style={{ transform: "translateX(-50%)" }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <div className="overflow-hidden rounded-md border border-gray-300 bg-gray-900 shadow-lg dark:border-gray-500 dark:bg-gray-800">
              <div
                className={[
                  "max-h-100 overscroll-none overflow-x-hidden overflow-y-auto",
                  "px-3 py-2 text-left text-sm text-white",
                  "[&_h1]:mb-2 [&_h1]:border-b [&_h1]:border-gray-500 [&_h1]:pb-1 [&_h1]:text-lg [&_h1]:font-bold",
                  "[&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-bold",
                  "[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
                  "[&_p]:mb-2 [&_p]:last:mb-0",
                  "[&_br]:block [&_br]:content-[''] [&_br]:mb-1",
                  "[&_strong]:font-bold [&_em]:italic",
                  "[&_code]:rounded [&_code]:bg-gray-700 [&_code]:px-1 [&_code]:text-xs",
                  "[&_a]:underline [&_a]:text-blue-300",
                  "[&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4",
                  "[&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4",
                  "[&_li]:mb-0.5",
                  "[&_hr]:my-2 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-gray-400 dark:[&_hr]:border-gray-500",
                  "[&_blockquote]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-500 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-gray-300",
                  "[&_pre]:mb-1 [&_pre]:rounded [&_pre]:bg-gray-700 [&_pre]:p-2 [&_pre]:text-xs",
                  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
                ].join(" ")}
                style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
              >
                <Markdown>{description}</Markdown>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// ============================================================================
// Column resize handle
// ============================================================================

interface ColumnSortIconProps {
  colKey: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
}

function ColumnSortIcon({
  colKey,
  sortKey,
  sortDir,
}: Readonly<ColumnSortIconProps>) {
  if (sortKey !== colKey) return null;
  if (sortDir === "asc") {
    return (
      <HiArrowDown className="h-3 w-3 shrink-0 text-blue-500 dark:text-gray-200" />
    );
  }
  return (
    <HiArrowUp className="h-3 w-3 shrink-0 text-blue-500 dark:text-gray-200" />
  );
}

// ============================================================================
// Column width persistence helpers
// ============================================================================

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const { dictionary, editMode, updateWidgetConfig } = useOptionalDashboard();
  const config = widget.config as unknown as DashletConfig;
  const {
    title = defaultConfig.title,
    showRowCount = defaultConfig.showRowCount,
    showColumnDividers = defaultConfig.showColumnDividers,
    dataMode = defaultConfig.dataMode,
    columns = defaultColumns,
    rows: staticRows = defaultRows,
    pgrestFunctionName = "",
    pgrestParams = [],
    pgrestHttpMethod = "POST",
    sort = defaultSort,
    dataSourceId,
    plannerVariableName,
    showExport = true,
    striped = false,
  } = config;
  const filter = useMemo(
    () => normalizeFilterConfig(config.filter, defaultFilter),
    [config.filter]
  );
  const safeRowColorRules = useMemo(
    () =>
      normalizeColorRulesConfig(config.rowColorRules, {
        enabled: false,
        rules: [],
      }),
    [config.rowColorRules]
  );
  const safeActions = useMemo(
    () => normalizeActionsConfig(config.actions, { enabled: false, items: [] }),
    [config.actions]
  );
  const safeRowActions = useMemo(
    () => normalizeRowActions(config.rowActions),
    [config.rowActions]
  );

  // ── Data fetching ───────────────────────────────────────────────────────────
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const {
    rows: fetchedRows,
    loading,
    fetchError,
  } = useDashletData({
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    pgrestParams,
    dataSourceId,
    plannerVariableName,
    refreshIntervalMs,
  });

  const allRows =
    dataMode === "pgrest" || dataMode === "planner" ? fetchedRows : staticRows;

  // ── Legacy filter & sort ──────────────────────────────────────────────────
  const {
    sortKey,
    sortDir,
    displayRows: legacyDisplayRows,
    handleSortClick,
  } = useFilterAndSort(filter, { ...sort, enabled: true }, allRows, columns);

  // ── Per-column filters ─────────────────────────────────────────────────────
  const {
    filters: columnFilters,
    filteredData: displayRows,
    enumValues,
    resolvedDataTypes,
    setFilter: setColumnFilter,
    removeFilter: removeColumnFilter,
    clearAllFilters: clearAllColumnFilters,
    activeFilterCount,
    totalCount: columnFilterTotal,
    filteredCount: columnFilteredCount,
  } = useColumnFilters(legacyDisplayRows, columns);

  // ── Handlebars template compilation ────────────────────────────────────────
  const { resolveValue, resolveLabel, resolveType } = useCompiledColumns(
    columns,
    displayRows.length
  );

  // ── Title bar data ──────────────────────────────────────────────────────────
  const titleBarData = buildTitleBarData({
    title,
    showRowCount,
    showExport,
    columns,
    displayRows,
    resolveValue,
    resolveLabel,
    dictionary,
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col gap-3">
      <DashletTitleBar
        {...titleBarData}
        rowCountLabel={trDynamic(
          displayRows.length === 1
            ? "dashboard.settings.totalItemsSingular"
            : "dashboard.settings.totalItems",
          dictionary,
          { count: String(displayRows.length) }
        )}
      />

      {/* Per-column filter toolbar */}
      {activeFilterCount > 0 && (
        <ColumnFilterToolbar
          filters={columnFilters}
          columns={columns}
          totalCount={columnFilterTotal}
          filteredCount={columnFilteredCount}
          onRemove={removeColumnFilter}
          onClearAll={clearAllColumnFilters}
        />
      )}

      <DataTable
        columns={columns}
        rows={displayRows}
        label={title}
        loading={loading}
        {...tableStatusLabels(dictionary, fetchError, tr("dashboard.settings.moreActions", dictionary))}
        showColumnDividers={showColumnDividers ?? true}
        striped={striped}
        resolveValue={resolveValue}
        resolveLabel={resolveLabel}
        resolveType={resolveType}
        resizing={{
          savedWidths: config.columnWidths,
          editable: editMode,
          onCommit: (columnWidths) =>
            updateWidgetConfig(widget.id, { ...widget.config, columnWidths }),
          handleLabel: (column) =>
            tr("dashboard.settings.tableResizeColumn", dictionary, { column }),
        }}
        rowColor={(row, index) =>
          safeRowColorRules.enabled
            ? findMatchingColor(
                safeRowColorRules.rules,
                row,
                resolveValue,
                index,
                displayRows.length
              )
            : null
        }
        rowActions={
          safeRowActions.length
            ? (row) =>
                safeRowActions.map((action) => ({
                  action,
                  href: resolveHandlebarsField(action.link, { ...row, row }),
                }))
            : undefined
        }
        renderHeader={(column, label) => (
          <div className="flex items-center gap-1 overflow-hidden">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 overflow-hidden"
              onClick={() => handleSortClick(column.key)}
            >
              {column.descriptionEnabled && column.description ? (
                <MarkdownTooltip description={column.description}>
                  <span className="truncate border-b border-dashed">
                    {label}
                  </span>
                </MarkdownTooltip>
              ) : (
                <span className="truncate">{label}</span>
              )}
              <ColumnSortIcon
                colKey={column.key}
                sortKey={sortKey}
                sortDir={sortDir}
              />
            </button>
            <ColumnFilterPopover
              columnKey={column.key}
              columnLabel={label}
              dataType={resolvedDataTypes[column.key] ?? "text"}
              currentFilter={columnFilters[column.key]}
              enumValues={enumValues[column.key] ?? []}
              onFilterChange={setColumnFilter}
            />
          </div>
        )}
        renderActions={tableRowActions(safeActions, tr("dashboard.settings.moreActions", dictionary))}
      />
    </div>
  );
}
