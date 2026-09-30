"use client";
import type { ReactNode } from "react";
import type { DataTableColumn } from "./data-table";
import { TableCellValue } from "./table-cell";

export interface DataListCardLayout {
  titleColumn: string;
  subtitleColumn: string;
  headerBadgeColumns: string[];
  kpiColumns: string[];
  footerColumns: string[];
}
export interface DataListCardProps {
  readonly row: Record<string, string>;
  readonly rowIdx: number;
  readonly totalRows: number;
  readonly columns: readonly DataTableColumn[];
  readonly cardLayout: DataListCardLayout;
  readonly resolveValue: (
    key: string,
    row: Record<string, string>,
    index: number,
    count: number,
  ) => string;
  readonly resolveLabel: (key: string) => string;
  readonly resolveType: (
    key: string,
    row: Record<string, string>,
    index: number,
    count: number,
  ) => string;
  readonly actions?: ReactNode;
}
/** Display authorized row data; templates, queries and actions belong to the host. */
export function DataListCard({
  row,
  rowIdx,
  totalRows,
  columns,
  cardLayout,
  resolveValue,
  resolveLabel,
  resolveType,
  actions,
}: DataListCardProps) {
  const value = (key: string) => resolveValue(key, row, rowIdx, totalRows);
  const cell = (key: string, fallback: string) => {
    const column = columns.find((column) => column.key === key);
    return (
      <TableCellValue
        value={value(key)}
        type={resolveType(key, row, rowIdx, totalRows) || fallback}
        colorMap={column?.colorRulesEnabled ? column.colorMap : undefined}
      />
    );
  };
  const title = value(cardLayout.titleColumn);
  const subtitle = value(cardLayout.subtitleColumn);
  return (
    <article className="miot-data-list-card" aria-label={title || undefined}>
      <header>
        <div>
          <div className="miot-data-list-card__title">
            <strong>{title}</strong>
            {cardLayout.headerBadgeColumns.map((key) =>
              value(key) ? <span key={key}>{cell(key, "badge")}</span> : null,
            )}
          </div>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </header>
      {cardLayout.kpiColumns.length > 0 && (
        <dl className="miot-data-list-card__metrics">
          {cardLayout.kpiColumns.map((key) => (
            <div key={key}>
              <dt>{resolveLabel(key)}</dt>
              <dd>{cell(key, "text")}</dd>
            </div>
          ))}
        </dl>
      )}
      {cardLayout.footerColumns.length > 0 && (
        <dl className="miot-data-list-card__footer">
          {cardLayout.footerColumns.map((key) => (
            <div key={key}>
              <dt>{resolveLabel(key)}:</dt>
              <dd>{cell(key, "text")}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
