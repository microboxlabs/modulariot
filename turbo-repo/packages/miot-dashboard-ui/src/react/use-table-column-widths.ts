"use client";
import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useCallback,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";
export interface WidthColumn {
  readonly key: string;
  readonly sticky?: boolean;
}
export interface TableColumnWidthsOptions {
  readonly columns: readonly WidthColumn[];
  readonly savedWidths?: Record<string, number>;
  readonly tableRef: RefObject<HTMLTableElement | null>;
  readonly headerRowRef: RefObject<HTMLTableRowElement | null>;
  readonly hasActions: boolean;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly editable?: boolean;
  readonly onCommit?: (widths: Record<string, number>) => void;
  readonly measureStickyOffsets: () => void;
}
/** Overlay saved widths (by column key) onto measured widths (by index). */
function applySavedWidths(
  measured: (number | null)[],
  columns: readonly WidthColumn[],
  saved: Record<string, number> | undefined,
): (number | null)[] {
  if (!saved) return measured;
  const lastIdx = columns.length - 1;
  return measured.map((w, i) => {
    if (i === lastIdx) return null;
    const key = columns[i]?.key;
    const value =
      key !== undefined && Object.hasOwn(saved, key) ? saved[key] : undefined;
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : w;
  });
}

/** Convert index-based widths into the key-based shape stored in config. */
function toColumnWidthRecord(
  widths: (number | null)[],
  columns: readonly WidthColumn[],
): Record<string, number> {
  const record: Record<string, number> = {};
  const lastIdx = columns.length - 1;
  columns.forEach((col, i) => {
    const w = widths[i];
    if (i !== lastIdx && w != null && Number.isFinite(w) && w > 0) {
      Object.defineProperty(record, col.key, {
        value: Math.round(w),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  });
  return record;
}

/**
 * True when the saved widths no longer match the widths on screen, e.g. after
 * undo/redo. A drag in edit mode saves the widths already shown, so it is false.
 */
function savedWidthsDiffer(
  widths: (number | null)[],
  columns: readonly WidthColumn[],
  saved: Record<string, number> | undefined,
): boolean {
  return (
    JSON.stringify(saved ?? {}) !==
    JSON.stringify(toColumnWidthRecord(widths, columns))
  );
}

/**
 * Drag-resize sizes the last column with inline styles React doesn't manage;
 * clear them so it fills the remaining space again after a re-measure.
 */
function clearColumnInlineWidth(table: HTMLTableElement, position: number) {
  const selector = `colgroup col:nth-child(${position}), thead th:nth-child(${position}), tbody td:nth-child(${position})`;
  table.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.style.width = "";
    el.style.minWidth = "";
    el.style.maxWidth = "";
  });
}

export function useTableColumnWidths({
  columns,
  savedWidths,
  tableRef,
  headerRowRef,
  hasActions,
  loading,
  error,
  editable = false,
  onCommit,
  measureStickyOffsets,
}: TableColumnWidthsOptions) {
  const cancelDrag = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cancelDrag.current?.(), [columns, loading, error]);
  const [columnWidths, setColumnWidths] = useState<(number | null)[]>([]);
  const thRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const colRefs = useRef<(HTMLTableColElement | null)[]>([]);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const columnWidthsRef = useRef(columnWidths);
  columnWidthsRef.current = columnWidths;
  const hasActionsRef = useRef(hasActions);
  hasActionsRef.current = hasActions;
  const savedWidthsRef = useRef(savedWidths);
  savedWidthsRef.current = savedWidths;
  // Re-measure when column keys/order or the saved widths change (undo/redo,
  // column edits), not only when the column count changes.
  const columnKeysSig = JSON.stringify(columns.map((c) => c.key));
  const savedWidthsSig = JSON.stringify(savedWidths ?? {});
  const measuredKeysSigRef = useRef(columnKeysSig);
  const measuredSavedSigRef = useRef(savedWidthsSig);

  // Persist once per completed interaction (drag release / auto-fit), never
  // while dragging — and only in edit mode. In view mode the resize stays in
  // local state for this viewer. Read through a ref so the document-level
  // mouseup listener created at drag start always sees the latest config.
  const persistWidths = (widths: (number | null)[]) => {
    if (editable) onCommit?.(toColumnWidthRecord(widths, columnsRef.current));
  };
  const persistWidthsRef = useRef(persistWidths);
  persistWidthsRef.current = persistWidths;

  // Measure natural content widths (auto layout) and commit them so the table
  // can retain the host layout for all user interaction.
  // Temporarily overrides the host layout for measurement, then restores it.
  useLayoutEffect(() => {
    const table = tableRef.current;
    const headerRow = headerRowRef.current;
    if (!table || !headerRow) return;
    const cols = columnsRef.current;
    if (!headerRow.children.length || !cols.length) return;

    // Clear stale ref-widths synchronously when the columns change so
    // measurement can proceed in this same layout pass without an extra render.
    const columnsChanged =
      columnWidthsRef.current.length !== cols.length ||
      measuredKeysSigRef.current !== columnKeysSig;
    // Only a change to the saved widths re-measures, so view-mode resizes
    // survive data refreshes.
    const savedChanged = measuredSavedSigRef.current !== savedWidthsSig;
    measuredKeysSigRef.current = columnKeysSig;
    measuredSavedSigRef.current = savedWidthsSig;
    if (columnsChanged) {
      columnWidthsRef.current = [];
      thRefs.current = [];
    } else if (
      savedChanged &&
      savedWidthsDiffer(columnWidthsRef.current, cols, savedWidthsRef.current)
    ) {
      columnWidthsRef.current = [];
    }

    if (!columnWidthsRef.current.every((w) => w === null)) return;

    const containerWidth = table.offsetWidth;
    clearColumnInlineWidth(table, cols.length);

    const previousLayout = table.style.tableLayout;
    const previousWidth = table.style.width;
    table.style.tableLayout = "auto";
    table.style.width = "max-content";
    table.getBoundingClientRect(); // force reflow in auto mode

    const cells = headerRow.children;
    const lastIdx = cols.length - 1;
    // Measure every data column except the last, which stays unconstrained
    // (null) so it fills whatever space is left — same rule drag-resize and
    // autoFitColumn already follow (see the block comment above).
    const measured = cols.map((_, i) =>
      i === lastIdx ? null : ((cells[i] as HTMLElement)?.offsetWidth ?? null),
    );
    // Saved widths win over measured ones; columns without a saved width
    // (e.g. newly added) keep their natural content width.
    const raw = applySavedWidths(measured, cols, savedWidthsRef.current);

    table.style.tableLayout = previousLayout;
    table.style.width = previousWidth;

    // Account for the actions column so it doesn't eat into the last data column.
    const actionsW = hasActionsRef.current ? 40 : 0;
    const available = containerWidth - actionsW;
    const sum = raw.reduce<number>((a, w) => a + (w ?? 0), 0);
    // Scale proportionally if natural widths overflow the container.
    const snapshot =
      sum > available && available > 0
        ? raw.map((w) =>
            w == null ? null : Math.max(40, Math.round((w * available) / sum)),
          )
        : raw;

    columnWidthsRef.current = snapshot;
    setColumnWidths(snapshot);
  }, [loading, error, columns.length, columnKeysSig, savedWidthsSig]);

  const handleResizeMouseDown = useCallback(
    (e: ReactMouseEvent, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();

      const colEl = colRefs.current[colIdx];
      const thEl = thRefs.current[colIdx];
      if (!colEl) return;

      const startX = e.clientX;
      const startWidth = colEl.offsetWidth;

      cancelDrag.current?.();
      const doc = colEl.ownerDocument;
      const previousCursor = doc.body.style.cursor;
      const previousSelection = doc.body.style.userSelect;
      doc.body.style.cursor = "col-resize";
      doc.body.style.userSelect = "none";

      const applyWidth = (w: number) => {
        const table = tableRef.current;
        if (!table) return;
        const px = `${w}px`;
        colEl.style.width = px;
        colEl.style.minWidth = px;
        colEl.style.maxWidth = px;
        if (thEl) {
          thEl.style.width = px;
          thEl.style.minWidth = px;
          thEl.style.maxWidth = px;
        }
        table
          .querySelectorAll<HTMLTableCellElement>(
            `tbody tr td:nth-child(${colIdx + 1})`,
          )
          .forEach((td) => {
            td.style.width = px;
            td.style.minWidth = px;
            td.style.maxWidth = px;
          });

        // Keep the last column filling all remaining space.
        const lastIdx = columnsRef.current.length - 1;
        const lastColEl = colRefs.current[lastIdx];
        const lastThEl = thRefs.current[lastIdx];
        if (lastColEl && lastThEl) {
          const containerW =
            table.parentElement?.clientWidth ?? table.offsetWidth;
          const actionsW = hasActionsRef.current ? 40 : 0;
          let sumOthers = actionsW;
          colRefs.current.forEach((c, i) => {
            if (i === lastIdx) return;
            sumOthers +=
              i === colIdx ? w : Number.parseFloat(c?.style.width ?? "0") || 0;
          });
          const lastW = Math.max(40, containerW - sumOthers);
          const lastPx = `${lastW}px`;
          lastColEl.style.width = lastPx;
          lastColEl.style.minWidth = lastPx;
          lastColEl.style.maxWidth = lastPx;
          lastThEl.style.width = lastPx;
          lastThEl.style.minWidth = lastPx;
          lastThEl.style.maxWidth = lastPx;
          table
            .querySelectorAll<HTMLTableCellElement>(
              `tbody tr td:nth-child(${lastIdx + 1})`,
            )
            .forEach((td) => {
              td.style.width = lastPx;
              td.style.minWidth = lastPx;
              td.style.maxWidth = lastPx;
            });
        }

        if (columnsRef.current.some((c) => c.sticky)) {
          measureStickyOffsets();
        }
      };

      const onMouseMove = (ev: MouseEvent) => {
        applyWidth(Math.max(80, startWidth + (ev.clientX - startX)));
      };

      const onMouseUp = (ev: MouseEvent) => {
        finishDrag();
        const finalWidth = Math.max(80, startWidth + (ev.clientX - startX));
        applyWidth(finalWidth);
        const next = [...columnWidthsRef.current];
        next[colIdx] = finalWidth;
        const lastIdx = columnsRef.current.length - 1;
        const lastThEl = thRefs.current[lastIdx];
        if (lastThEl)
          next[lastIdx] =
            Number.parseFloat(lastThEl.style.width) || next[lastIdx] || null;
        columnWidthsRef.current = next;
        setColumnWidths(next);

        // A click without movement changes nothing — don't save.
        if (finalWidth !== startWidth) persistWidthsRef.current(next);
      };

      const finishDrag = () => {
        doc.body.style.cursor = previousCursor;
        doc.body.style.userSelect = previousSelection;
        doc.removeEventListener("mousemove", onMouseMove);
        doc.removeEventListener("mouseup", onMouseUp);
        doc.defaultView?.removeEventListener("blur", finishDrag);
        cancelDrag.current = undefined;
      };
      cancelDrag.current = finishDrag;
      doc.addEventListener("mousemove", onMouseMove);
      doc.addEventListener("mouseup", onMouseUp);
      doc.defaultView?.addEventListener("blur", finishDrag);
    },
    [measureStickyOffsets],
  );

  // Double-click a resize handle → auto-fit the column to its content width.
  const autoFitColumn = useCallback((colIdx: number) => {
    const colEl = colRefs.current[colIdx];
    const thEl = thRefs.current[colIdx];
    const table = tableRef.current;
    if (!colEl || !thEl || !table) return;

    const savedColWidths = columnsRef.current.map(
      (_, i) => colRefs.current[i]?.style.width ?? "",
    );

    // Clear all col widths + temp-switch to auto to measure content width.
    columnsRef.current.forEach((_, i) => {
      const col = colRefs.current[i];
      if (col) {
        col.style.width = "";
        col.style.minWidth = "";
        col.style.maxWidth = "";
      }
      const th = thRefs.current[i];
      if (th) {
        th.style.width = "";
        th.style.minWidth = "";
        th.style.maxWidth = "";
      }
      table
        .querySelectorAll<HTMLTableCellElement>(
          `tbody tr td:nth-child(${i + 1})`,
        )
        .forEach((td) => {
          td.style.width = "";
          td.style.minWidth = "";
          td.style.maxWidth = "";
        });
    });
    const previousLayout = table.style.tableLayout;
    const previousWidth = table.style.width;
    table.style.tableLayout = "auto";
    table.style.width = "max-content";
    table.getBoundingClientRect(); // force reflow
    const contentWidth = thEl.offsetWidth;

    // Restore other columns and the host layout after measuring.
    columnsRef.current.forEach((_, i) => {
      if (i !== colIdx) {
        const col = colRefs.current[i];
        if (col) col.style.width = savedColWidths[i] ?? "";
      }
    });
    table.style.tableLayout = previousLayout;
    table.style.width = previousWidth;
    table.getBoundingClientRect(); // force reflow

    colEl.style.width = `${contentWidth}px`;

    if (columnWidthsRef.current.every((w) => w === null)) {
      const cols = columnsRef.current;
      const snapshot = cols.map((_, i): number | null => {
        if (i === cols.length - 1) return null;
        if (i === colIdx) return contentWidth;
        const col = colRefs.current[i];
        return col ? Number.parseFloat(col.style.width) || null : null;
      });
      columnWidthsRef.current = snapshot;
      setColumnWidths(snapshot);
      persistWidthsRef.current(snapshot);
    } else {
      const next = [...columnWidthsRef.current];
      next[colIdx] = contentWidth;
      columnWidthsRef.current = next;
      setColumnWidths(next);
      persistWidthsRef.current(next);
    }
  }, []);

  return {
    columnWidths,
    thRefs,
    colRefs,
    handleResizeMouseDown,
    autoFitColumn,
  };
}
