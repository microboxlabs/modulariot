"use client";

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
import type {
  FilterItemConfig,
  FilterConfig,
} from "@/features/dashboard/dashlets/common/filter-types";
import { renderCell } from "@/features/dashboard/dashlets/common/cell-renderers";
import { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
import { FilterPillRow } from "@/features/dashboard/dashlets/common/filter-pill-row";
import { SortPillRow } from "@/features/dashboard/dashlets/common/sort-pill-row";
import { useFilterAndSort } from "@/features/dashboard/dashlets/common/use-filter-and-sort";
import { useColumnFilters } from "@/features/dashboard/dashlets/common/use-column-filters";
import { ColumnFilterPopover } from "@/features/dashboard/dashlets/common/column-filter-popover";
import { ColumnFilterToolbar } from "@/features/dashboard/dashlets/common/column-filter-toolbar";
import { useDashletData } from "@/features/dashboard/dashlets/common/use-dashlet-data";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useCompiledColumns } from "@/features/dashboard/dashlets/common/use-compiled-columns";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
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
import {
  findMatchingColor,
  getRowColorClasses,
} from "@/features/dashboard/dashlets/common/color-rule-engine";
import { normalizeColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-helpers";
import type { ActionsConfig } from "@/features/dashboard/dashlets/common/action-types";
import {
  normalizeActionsConfig,
  isSafeActionUrl,
} from "@/features/dashboard/dashlets/common/action-helpers";
import { resolveHandlebarsField } from "@/features/dashboard/dashlets/common/use-handlebars-templates";
import { ActionDropdown } from "@/features/dashboard/dashlets/common/action-dropdown";
import {
  DashletTitleBar,
  buildTitleBarData,
} from "@/features/dashboard/dashlets/common/dashlet-title-bar";

// ============================================================================
// Sticky column helpers
// ============================================================================

function measureLeftOffsets(
  columns: TableColumn[],
  cells: HTMLCollection
): Record<number, number> {
  const offsets: Record<number, number> = {};
  let left = 0;
  for (let i = 0; i < columns.length; i++) {
    if (!columns[i].sticky) break;
    offsets[i] = left;
    const cell = cells[i] as HTMLElement | undefined;
    if (cell) left += cell.offsetWidth;
  }
  return offsets;
}

function measureRightOffsets(
  columns: TableColumn[],
  cells: HTMLCollection,
  leftOff: Record<number, number>,
  actionsWidth: number
): Record<number, number> {
  const offsets: Record<number, number> = {};
  let right = actionsWidth;
  for (let i = columns.length - 1; i >= 0; i--) {
    if (!columns[i].sticky) break;
    if (leftOff[i] !== undefined) break;
    offsets[i] = right;
    const cell = cells[i] as HTMLElement | undefined;
    if (cell) right += cell.offsetWidth;
  }
  return offsets;
}

function buildStickyThClass(
  colIdx: number,
  lastStickyIdx: number,
  firstStickyRightIdx: number
): string {
  const base =
    "relative sticky top-0 whitespace-nowrap bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400";
  if (colIdx <= lastStickyIdx) {
    const shadow =
      colIdx === lastStickyIdx
        ? " shadow-[inset_-1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_-1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} left-0 z-30${shadow}`;
  }
  if (firstStickyRightIdx >= 0 && colIdx >= firstStickyRightIdx) {
    const shadow =
      colIdx === firstStickyRightIdx
        ? " shadow-[inset_1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} right-0 z-30${shadow}`;
  }
  return base;
}

function stickyBgForColor(rowColor: string | null): string {
  switch (rowColor) {
    case "red":
      return "bg-red-50 dark:bg-gray-800";
    case "yellow":
      return "bg-yellow-50 dark:bg-gray-800";
    case "green":
      return "bg-green-50 dark:bg-gray-800";
    case "blue":
      return "bg-blue-50 dark:bg-gray-800";
    case "orange":
      return "bg-orange-50 dark:bg-gray-800";
    case "purple":
      return "bg-purple-50 dark:bg-gray-800";
    case "gray":
      return "bg-gray-100 dark:bg-gray-800";
    default:
      return "bg-white dark:bg-gray-800";
  }
}

function buildStickyTdClass(
  colIdx: number,
  lastStickyIdx: number,
  firstStickyRightIdx: number,
  showColumnDividers: boolean,
  columnsLength: number,
  rowColor: string | null
): string {
  const divider =
    showColumnDividers && colIdx < columnsLength - 1
      ? " relative after:absolute after:right-0 after:top-3 after:bottom-3 after:w-px after:bg-gray-200/30 dark:after:bg-gray-600/25"
      : "";
  const rowBorder = "border-t border-gray-200 dark:border-gray-600";
  const base = `${rowBorder} select-text px-4 py-4 text-gray-700 dark:text-gray-300${divider}`;
  if (colIdx <= lastStickyIdx) {
    const shadow =
      colIdx === lastStickyIdx
        ? " shadow-[inset_-1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_-1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} sticky left-0 z-10 ${stickyBgForColor(rowColor)}${shadow}`;
  }
  if (firstStickyRightIdx >= 0 && colIdx >= firstStickyRightIdx) {
    const shadow =
      colIdx === firstStickyRightIdx
        ? " shadow-[inset_1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} sticky right-0 z-10 ${stickyBgForColor(rowColor)}${shadow}`;
  }
  return base;
}

function buildStickyStyle(
  colIdx: number,
  leftOffsets: Record<number, number>,
  rightOffsets: Record<number, number>,
  lastStickyIdx: number,
  firstStickyRightIdx: number
): React.CSSProperties | undefined {
  if (colIdx <= lastStickyIdx && leftOffsets[colIdx] !== undefined) {
    const style: React.CSSProperties = { left: leftOffsets[colIdx] };
    if (colIdx < lastStickyIdx) {
      style.paddingRight = "calc(1rem + 0.1px)";
    }
    return style;
  }
  if (
    firstStickyRightIdx >= 0 &&
    colIdx >= firstStickyRightIdx &&
    rightOffsets[colIdx] !== undefined
  ) {
    const style: React.CSSProperties = { right: rightOffsets[colIdx] };
    if (colIdx > firstStickyRightIdx) {
      style.paddingLeft = "calc(1rem + 0.1px)";
    }
    return style;
  }
  return undefined;
}

// ============================================================================
// Config & Defaults
// ============================================================================

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  /** Show dim vertical dividers between table columns */
  showColumnDividers?: boolean;
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
  /** Show the export dropdown in the title bar */
  showExport?: boolean;
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

export const defaultConfig: DashletConfig = {
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
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
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
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={clampToViewport}
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

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}

function ResizeHandle({ onMouseDown, onDoubleClick }: Readonly<ResizeHandleProps>) {
  return (
    <div
      className="group/rh absolute inset-y-0 -right-1.5 z-10 flex w-4 cursor-col-resize select-none items-center justify-center"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="h-3 w-px rounded-full bg-gray-300 transition-colors group-hover/rh:bg-blue-400 dark:bg-gray-500 dark:group-hover/rh:bg-blue-500" />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const { dictionary } = useDashboard();
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
  const hasActions = safeActions.enabled && safeActions.items.length > 0;

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
    filterValues,
    sortKey,
    sortDir,
    filterOptionsByColumn,
    displayRows: legacyDisplayRows,
    validSortColumns,
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  } = useFilterAndSort(filter, sort, allRows, columns);

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

  // ── Sticky column offsets ───────────────────────────────────────────────────
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [stickyLeftOffsets, setStickyLeftOffsets] = useState<
    Record<number, number>
  >({});
  const [stickyRightOffsets, setStickyRightOffsets] = useState<
    Record<number, number>
  >({});

  const measureStickyOffsets = useCallback(() => {
    const row = headerRowRef.current;
    if (!row) return;
    const cells = row.children;

    const leftOff = measureLeftOffsets(columns, cells);
    setStickyLeftOffsets(leftOff);

    let actionsWidth = 0;
    if (hasActions && cells.length > columns.length) {
      const actionsCell = cells[cells.length - 1] as HTMLElement | undefined;
      if (actionsCell) actionsWidth = actionsCell.offsetWidth;
    }

    setStickyRightOffsets(
      measureRightOffsets(columns, cells, leftOff, actionsWidth)
    );
  }, [columns, hasActions]);

  useEffect(() => {
    measureStickyOffsets();

    const row = headerRowRef.current;
    window.addEventListener("resize", measureStickyOffsets);

    let observer: ResizeObserver | undefined;
    if (row) {
      observer = new ResizeObserver(measureStickyOffsets);
      observer.observe(row);
    }

    document.fonts?.ready.then(measureStickyOffsets);

    return () => {
      window.removeEventListener("resize", measureStickyOffsets);
      observer?.disconnect();
    };
  }, [measureStickyOffsets, displayRows]);

  const lastStickyIdx = useMemo(() => {
    let last = -1;
    for (let i = 0; i < columns.length; i++) {
      if (!columns[i].sticky) break;
      last = i;
    }
    return last;
  }, [columns]);

  const firstStickyRightIdx = useMemo(() => {
    let first = -1;
    for (let i = columns.length - 1; i >= 0; i--) {
      if (!columns[i].sticky) break;
      if (i <= lastStickyIdx) break;
      first = i;
    }
    return first;
  }, [columns, lastStickyIdx]);

  // ── Column resizing ─────────────────────────────────────────────────────────
  // Default state: table-layout:auto so the browser sizes columns by content
  // and the last column naturally fills remaining space. On the user's first
  // drag we snapshot the current auto-layout widths for all columns except the
  // last, apply them as explicit widths, and switch to table-layout:fixed —
  // from that point the last column continues to fill whatever space is left.
  const [columnWidths, setColumnWidths] = useState<(number | null)[]>([]);
  const thRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;

  useEffect(() => {
    setColumnWidths([]);
    thRefs.current = [];
  }, [columns.length]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();

      const thEl = thRefs.current[colIdx];
      if (!thEl) return;

      // On the very first drag, lock in the auto-layout widths so switching to
      // table-layout:fixed doesn't cause a visual jump.
      if (columnWidthsRef.current.every((w) => w === null)) {
        const cols = columnsRef.current;
        const snapshot = cols.map((_, i) =>
          i === cols.length - 1 ? null : (thRefs.current[i]?.offsetWidth ?? null)
        );
        // Apply directly to DOM first so the layout is identical when React
        // re-renders with table-layout:fixed.
        snapshot.forEach((w, i) => {
          const th = thRefs.current[i];
          if (th && w != null) th.style.width = `${w}px`;
        });
        columnWidthsRef.current = snapshot;
        setColumnWidths(snapshot);
      }

      const startX = e.clientX;
      const startWidth = thEl.offsetWidth;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.max(48, startWidth + (ev.clientX - startX));
        thEl.style.width = `${newWidth}px`;
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        const finalWidth = Math.max(48, startWidth + (ev.clientX - startX));
        thEl.style.width = `${finalWidth}px`;

        setColumnWidths((prev) => {
          const next = [...prev];
          next[colIdx] = finalWidth;
          return next;
        });

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    []
  );

  const hasExplicitWidths = columnWidths.some((w) => w !== null);

  // Double-click a resize handle → auto-fit the column to its content width.
  // All DOM mutations happen synchronously before the next browser paint → no flash.
  const autoFitColumn = useCallback((colIdx: number) => {
    const thEl = thRefs.current[colIdx];
    const table = thEl?.closest("table") as HTMLTableElement | null;
    if (!thEl || !table) return;

    // Save current state so we can restore everything except the target column.
    const prevLayout = table.style.tableLayout;
    const prevWidth = table.style.width;
    const savedWidths = columnsRef.current.map(
      (_, i) => thRefs.current[i]?.style.width ?? ""
    );

    // Remove all explicit widths and switch to auto layout with unconstrained
    // table width — each column now sizes to its true content width.
    columnsRef.current.forEach((_, i) => {
      const th = thRefs.current[i];
      if (th) th.style.width = "";
    });
    table.style.tableLayout = "auto";
    table.style.width = "max-content";

    // Synchronous reflow: browser computes content-based widths.
    void table.offsetWidth;
    const contentWidth = thEl.offsetWidth;

    // Restore all other columns and table state.
    columnsRef.current.forEach((_, i) => {
      if (i !== colIdx) {
        const th = thRefs.current[i];
        if (th) th.style.width = savedWidths[i];
      }
    });
    table.style.tableLayout = prevLayout;
    table.style.width = prevWidth;
    void table.offsetWidth;

    // Apply the measured width to the target column.
    thEl.style.width = `${contentWidth}px`;

    // Commit to React state (initialize fixed layout if this is the first resize).
    if (columnWidthsRef.current.every((w) => w === null)) {
      const cols = columnsRef.current;
      const snapshot = cols.map((_, i): number | null => {
        if (i === cols.length - 1) return null;
        if (i === colIdx) return contentWidth;
        return thRefs.current[i]?.offsetWidth ?? null;
      });
      snapshot.forEach((w, i) => {
        const th = thRefs.current[i];
        if (th && w != null) th.style.width = `${w}px`;
      });
      columnWidthsRef.current = snapshot;
      setColumnWidths(snapshot);
    } else {
      setColumnWidths((prev) => {
        const next = [...prev];
        next[colIdx] = contentWidth;
        return next;
      });
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  const allLabel = tr("common.all", dictionary);

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

      {/* Filter cards */}
      {filter.enabled &&
        filter.items.map((item: FilterItemConfig, idx: number) => {
          const options = filterOptionsByColumn[item.column];
          if (!options || options.length === 0) return null;
          return (
            <FilterPillRow
              key={`${item.column}-${idx}`}
              item={item}
              options={options}
              selected={filterValues[item.column] ?? ""}
              allLabel={allLabel}
              onClear={handleFilterClear}
              onSelect={handleFilterSelect}
            />
          );
        })}

      {/* Sort card */}
      {sort.enabled && (
        <SortPillRow
          label={tr("dashboard.settings.sortBy", dictionary)}
          columns={validSortColumns}
          sortKey={sortKey}
          sortDir={sortDir}
          getColumnLabel={getColumnLabel}
          onSortClick={handleSortClick}
        />
      )}

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

      {/* Table card */}
      <div className="flex-1 overflow-auto overscroll-none rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading && (
          <div className="flex h-20 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        )}
        {fetchError && (
          <div className="flex h-20 items-center justify-center text-sm text-red-500 dark:text-red-400">
            Error: {fetchError}
          </div>
        )}
        {!loading && !fetchError && (
          <table
            className="border-separate border-spacing-0 text-sm"
            style={{ tableLayout: hasExplicitWidths ? "fixed" : "auto", minWidth: "100%" }}
          >
            <thead className="sticky top-0 z-20">
              <tr ref={headerRowRef} className="bg-gray-50 dark:bg-gray-700">
                {columns.map((col, colIdx) => (
                  <th
                    key={col.key}
                    ref={(el) => { thRefs.current[colIdx] = el; }}
                    className={buildStickyThClass(
                      colIdx,
                      lastStickyIdx,
                      firstStickyRightIdx
                    )}
                    style={{
                      // Last column: no explicit width — fills remaining space.
                      ...(columnWidths[colIdx] != null && colIdx < columns.length - 1
                        ? { width: columnWidths[colIdx] }
                        : {}),
                      ...buildStickyStyle(
                        colIdx,
                        stickyLeftOffsets,
                        stickyRightOffsets,
                        lastStickyIdx,
                        firstStickyRightIdx
                      ),
                    }}
                  >
                    <div className="flex items-center gap-1 overflow-hidden">
                      {col.descriptionEnabled && col.description ? (
                        <MarkdownTooltip description={col.description}>
                          <span className="cursor-help truncate border-b border-dashed border-gray-400 dark:border-gray-500">
                            {resolveLabel(col.key)}
                          </span>
                        </MarkdownTooltip>
                      ) : (
                        <span className="truncate">{resolveLabel(col.key)}</span>
                      )}
                      <ColumnFilterPopover
                        columnKey={col.key}
                        columnLabel={resolveLabel(col.key)}
                        dataType={resolvedDataTypes[col.key] ?? "text"}
                        currentFilter={columnFilters[col.key]}
                        enumValues={enumValues[col.key] ?? []}
                        onFilterChange={setColumnFilter}
                      />
                    </div>
                    {colIdx < columns.length - 1 && (
                      <ResizeHandle
                        onMouseDown={(e) => handleResizeMouseDown(e, colIdx)}
                        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); autoFitColumn(colIdx); }}
                      />
                    )}
                  </th>
                ))}
                {hasActions && (
                  <th
                    className={`sticky right-0 z-30 w-10 bg-gray-50 px-2 py-3 dark:bg-gray-700 ${firstStickyRightIdx < 0 ? "border-l border-gray-200 dark:border-gray-600" : ""}`}
                  >
                    <span className="sr-only">
                      {tr("dashboard.settings.actions", dictionary)}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(columns.length || 1) + (hasActions ? 1 : 0)}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    No data
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rowIdx) => {
                  const rowColor = safeRowColorRules.enabled
                    ? findMatchingColor(
                        safeRowColorRules.rules,
                        row,
                        resolveValue,
                        rowIdx,
                        displayRows.length
                      )
                    : null;
                  const rowBgClass = rowColor
                    ? getRowColorClasses(rowColor)
                    : "bg-white dark:bg-gray-800";

                  return (
                    <tr key={row.id ?? row._id ?? rowIdx} className={rowBgClass}>
                      {columns.map((col, colIdx) => (
                        <td
                          key={col.key}
                          className={buildStickyTdClass(
                            colIdx,
                            lastStickyIdx,
                            firstStickyRightIdx,
                            showColumnDividers ?? true,
                            columns.length,
                            rowColor
                          )}
                          style={buildStickyStyle(
                            colIdx,
                            stickyLeftOffsets,
                            stickyRightOffsets,
                            lastStickyIdx,
                            firstStickyRightIdx
                          )}
                        >
                          {renderCell(
                            resolveValue(
                              col.key,
                              row,
                              rowIdx,
                              displayRows.length
                            ),
                            resolveType(
                              col.key,
                              row,
                              rowIdx,
                              displayRows.length
                            ),
                            col.colorRulesEnabled ? col.colorMap : undefined
                          )}
                        </td>
                      ))}
                      {hasActions && (
                        <td
                          className={`sticky right-0 border-t border-gray-200 px-2 py-4 dark:border-gray-600 ${firstStickyRightIdx < 0 ? "border-l" : ""} ${stickyBgForColor(rowColor)}`}
                        >
                          <ActionDropdown
                            items={safeActions.items
                              .map((action) => {
                                const ctx = { ...row, row };
                                const href = resolveHandlebarsField(
                                  action.link,
                                  ctx
                                );
                                return isSafeActionUrl(href)
                                  ? { action, href }
                                  : null;
                              })
                              .filter(
                                (item): item is NonNullable<typeof item> =>
                                  item !== null
                              )}
                            ariaLabel={tr(
                              "dashboard.settings.moreActions",
                              dictionary
                            )}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
