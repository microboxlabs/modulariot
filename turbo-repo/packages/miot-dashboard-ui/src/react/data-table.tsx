"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { TableCellValue, type CellColorRule } from "./table-cell";

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
export interface DataTableProps {
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
function rowStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !/^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) return undefined;
  const hex = color.startsWith("#") ? color : `#${color}`;
  return {
    "--miot-row-background": `color-mix(in srgb, ${hex} 12%, var(--miot-card-background, #fff))`,
  } as CSSProperties;
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
}: DataTableProps) {
  const header = useRef<HTMLTableRowElement>(null);
  const [offsets, setOffsets] = useState<StickyOffsets>({
    left: {},
    right: {},
  });
  const hasActions = Boolean(renderActions);
  useLayoutEffect(() => {
    const row = header.current;
    if (!row) return;
    const measure = () =>
      setOffsets(stickyOffsets(columns, row.children, hasActions));
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
  }, [columns, hasActions, rows, loading, errorLabel]);
  return (
    <div className="miot-data-table" data-dividers={showColumnDividers}>
      {loading && (
        <output className="miot-data-table__message">{loadingLabel}</output>
      )}
      {errorLabel && (
        <div className="miot-data-table__message" role="alert">
          {errorLabel}
        </div>
      )}
      {!loading && !errorLabel && (
        <table aria-label={label}>
          <thead>
            <tr ref={header}>
              {columns.map((column, index) => {
                const title = resolveLabel?.(column.key) ?? column.label;
                return (
                  <th
                    scope="col"
                    key={column.key}
                    style={cellPosition(index, offsets)}
                  >
                    {renderHeader ? renderHeader(column, title) : title}
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
                <tr
                  key={row.id ?? row._id ?? index}
                  data-row-color={rowColor?.(row, index) ?? undefined}
                  style={rowStyle(rowColor?.(row, index))}
                >
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.key}
                      style={cellPosition(columnIndex, offsets)}
                    >
                      <TableCellValue
                        value={resolveValue(
                          column.key,
                          row,
                          index,
                          rows.length,
                        )}
                        type={
                          resolveType?.(column.key, row, index, rows.length) ??
                          column.type
                        }
                        colorMap={
                          column.colorRulesEnabled ? column.colorMap : undefined
                        }
                      />
                      {column.decorator && (
                        <span className="miot-data-table__decorator">
                          {column.decorator}
                        </span>
                      )}
                    </td>
                  ))}
                  {renderActions && (
                    <td className="miot-data-table__actions">
                      {renderActions(row, index)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
