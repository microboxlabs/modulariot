"use client";
import {
  useLayoutEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { CellColorRule } from "./table-cell";
import { DataTableRow } from "./data-table-row";
import type { ResolvedContextItem } from "./row-context-menu";
import { useTableColumnWidths } from "./use-table-column-widths";

export interface DataTableColumn {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly sticky?: boolean;
  readonly colorRulesEnabled?: boolean;
  readonly colorMap?: readonly CellColorRule[];
  readonly decorator?: string;
  readonly descriptionEnabled?: boolean;
  readonly description?: string;
}
export interface TableResizingOptions {
  readonly savedWidths?: Record<string, number>;
  readonly editable?: boolean;
  readonly onCommit?: (widths: Record<string, number>) => void;
  /** Explain drag, arrow-key adjustment and Enter/double-click auto-fit. */
  readonly handleLabel: (columnLabel: string) => string;
}
export interface DataTableProps {
  readonly striped?: boolean;
  readonly rowActions?: (
    row: Record<string, string>,
    index: number,
  ) => readonly ResolvedContextItem[];
  readonly resizing?: TableResizingOptions;
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly Record<string, string>[];
  readonly label: string;
  readonly emptyLabel: string;
  readonly loadingLabel: string;
  readonly actionsLabel: string;
  readonly loading?: boolean;
  readonly errorLabel?: string;
  readonly showColumnDividers?: boolean;
  readonly resolveValue: (
    key: string,
    row: Record<string, string>,
    index: number,
    count: number,
  ) => string;
  readonly resolveLabel?: (key: string) => string;
  readonly resolveType?: (
    key: string,
    row: Record<string, string>,
    index: number,
    count: number,
  ) => string;
  readonly renderHeader?: (column: DataTableColumn, label: string) => ReactNode;
  readonly renderActions?: (
    row: Record<string, string>,
    index: number,
  ) => ReactNode;
  readonly rowColor?: (
    row: Record<string, string>,
    index: number,
  ) => string | null;
}
interface StickyOffsets {
  left: Record<number, number>;
  right: Record<number, number>;
}
function stickyOffsets(
  columns: readonly DataTableColumn[],
  cells: HTMLCollection,
  hasActions: boolean,
): StickyOffsets {
  const result: StickyOffsets = { left: {}, right: {} };
  let offset = 0;
  for (
    let index = 0;
    index < columns.length && columns[index]?.sticky;
    index++
  ) {
    result.left[index] = offset;
    offset += (cells[index] as HTMLElement | undefined)?.offsetWidth ?? 0;
  }
  offset = hasActions
    ? ((cells[columns.length] as HTMLElement | undefined)?.offsetWidth ?? 0)
    : 0;
  for (
    let index = columns.length - 1;
    index >= 0 && columns[index]?.sticky && result.left[index] === undefined;
    index--
  ) {
    result.right[index] = offset;
    offset += (cells[index] as HTMLElement | undefined)?.offsetWidth ?? 0;
  }
  return result;
}
function cellPosition(
  index: number,
  offsets: StickyOffsets,
): CSSProperties | undefined {
  if (offsets.left[index] !== undefined)
    return { position: "sticky", left: offsets.left[index] };
  if (offsets.right[index] !== undefined)
    return { position: "sticky", right: offsets.right[index] };
  return undefined;
}
/** Presentational table over authorized results; hosts own queries and controls. */
export function DataTable({
  columns,
  rows,
  label,
  emptyLabel,
  loadingLabel,
  actionsLabel,
  loading = false,
  errorLabel,
  showColumnDividers = true,
  resolveValue,
  resolveLabel,
  resolveType,
  renderHeader,
  renderActions,
  rowColor,
  resizing,
  rowActions,
  striped = false,
}: DataTableProps) {
  const header = useRef<HTMLTableRowElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [offsets, setOffsets] = useState<StickyOffsets>({
    left: {},
    right: {},
  });
  const hasActions = Boolean(renderActions || rowActions);
  const measure = useCallback(() => {
    const row = header.current;
    if (row) setOffsets(stickyOffsets(columns, row.children, hasActions));
  }, [columns, hasActions]);
  const widths = useTableColumnWidths({
    columns,
    enabled: Boolean(resizing),
    savedWidths: resizing?.savedWidths,
    editable: resizing?.editable,
    onCommit: resizing?.onCommit,
    tableRef: table,
    headerRowRef: header,
    hasActions,
    loading,
    error: errorLabel,
    measureStickyOffsets: measure,
  });
  const position = (index: number): CSSProperties => {
    const width = resizing ? widths.columnWidths[index] : undefined;
    return {
      ...cellPosition(index, offsets),
      ...(width == null ? {} : { width, minWidth: width, maxWidth: width }),
    };
  };
  useLayoutEffect(() => {
    const row = header.current;
    if (!row) return;
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(row);
    for (const cell of row.children) observer?.observe(cell);
    const win = row.ownerDocument.defaultView;
    win?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      win?.removeEventListener("resize", measure);
    };
  }, [
    columns,
    hasActions,
    rows,
    loading,
    errorLabel,
    measure,
    widths.columnWidths,
  ]);
  return (
    <div
      className="miot-data-table"
      data-dividers={showColumnDividers}
      data-resizable={Boolean(resizing)}
      data-striped={striped}
    >
      {loading && (
        <output className="miot-data-table__message">{loadingLabel}</output>
      )}
      {errorLabel && (
        <div className="miot-data-table__message" role="alert">
          {errorLabel}
        </div>
      )}
      {!loading && !errorLabel && (
        <table
          ref={table}
          aria-label={label}
          style={
            resizing
              ? {
                  tableLayout: "fixed",
                  minWidth:
                    widths.columnWidths
                      .slice(0, -1)
                      .reduce<number>((sum, width) => sum + (width ?? 0), 0) +
                    80 +
                    widths.actionsColumnWidth,
                }
              : undefined
          }
        >
          {resizing && (
            <colgroup>
              {columns.map((column, index) => (
                <col
                  key={column.key}
                  ref={(element) => {
                    widths.colRefs.current[index] = element;
                  }}
                  style={{ width: widths.columnWidths[index] ?? undefined }}
                />
              ))}
              {hasActions && <col />}
            </colgroup>
          )}
          <thead>
            <tr ref={header}>
              {columns.map((column, index) => {
                const title = resolveLabel?.(column.key) ?? column.label;
                return (
                  <th
                    scope="col"
                    key={column.key}
                    ref={(element) => {
                      widths.thRefs.current[index] = element;
                    }}
                    data-sticky={cellPosition(index, offsets)?.position === "sticky" || undefined}
                    style={position(index)}
                  >
                    {renderHeader ? renderHeader(column, title) : title}
                    {resizing && index < columns.length - 1 && (
                      <button
                        type="button"
                        className="miot-data-table__resize"
                        aria-label={resizing.handleLabel(title)}
                        title={resizing.handleLabel(title)}
                        onPointerDown={(event) =>
                          widths.handleResizePointerDown(event, index)
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          if (event.detail === 0) widths.autoFitColumn(index);
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          widths.autoFitColumn(index);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key !== "ArrowLeft" &&
                            event.key !== "ArrowRight"
                          )
                            return;
                          event.preventDefault();
                          event.stopPropagation();
                          widths.resizeColumnBy(
                            index,
                            (event.key === "ArrowRight" ? 1 : -1) *
                              (event.shiftKey ? 50 : 10),
                          );
                        }}
                      >
                        <span aria-hidden="true">⋮</span>
                      </button>
                    )}
                  </th>
                );
              })}
              {hasActions && (
                <th scope="col" className="miot-data-table__actions">
                  <span className="miot-data-table__sr-only">
                    {actionsLabel}
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="miot-data-table__message"
                  colSpan={Math.max(1, columns.length + Number(hasActions))}
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <DataTableRow
                  key={row.id ?? row._id ?? index}
                  row={row}
                  index={index}
                  count={rows.length}
                  columns={columns}
                  color={rowColor?.(row, index)}
                  position={position}
                  hasActions={hasActions}
                  actions={rowActions?.(row, index) ?? []}
                  actionsLabel={actionsLabel}
                  resolveValue={resolveValue}
                  resolveType={resolveType}
                  renderActions={renderActions}
                />

              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
