"use client";
import type { QueryPreview } from "@microboxlabs/miot-dashboard-contract/authoring";
import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import { fill, formatBytes, type QueryWorkbenchLabels } from "./labels";

/** Rows rendered in the table; copying takes all of them. */
export const SHOWN_ROWS = 500;

function text(value: DashboardQueryValue | undefined): string {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function csvCell(value: DashboardQueryValue | undefined): string {
  const cell = text(value);
  return /[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function toCsv(preview: QueryPreview): string {
  const names = preview.columns.map((column) => column.name);
  return [
    names.map((name) => csvCell(name)).join(","),
    ...preview.rows.map((row) =>
      names.map((name) => csvCell(row[name])).join(","),
    ),
  ].join("\n");
}

export interface ResultsTableProps {
  readonly preview: QueryPreview | null;
  readonly labels: QueryWorkbenchLabels;
  readonly locale?: string;
  readonly onCopy: (text: string) => void;
}

export function ResultsTable({
  preview,
  labels,
  locale,
  onCopy,
}: ResultsTableProps) {
  if (!preview || !preview.ok) {
    return (
      <section className="miot-qw-results" aria-label={labels.results}>
        <p className="miot-qw-muted">{labels.noResults}</p>
      </section>
    );
  }
  const shown = preview.rows.slice(0, SHOWN_ROWS);
  return (
    <section className="miot-qw-results" aria-label={labels.results}>
      <header className="miot-qw-results__header">
        <span>
          {fill(labels.resultSummary, {
            rows: preview.totalRows.toLocaleString(locale),
            bytes: formatBytes(preview.totalBytesProcessed, locale),
            ms: preview.durationMs.toLocaleString(locale),
          })}
          {preview.cacheHit && ` · ${labels.cached}`}
        </span>
        <span className="miot-qw-results__actions">
          <button
            type="button"
            className="miot-qw-button"
            onClick={() => onCopy(toCsv(preview))}
          >
            {labels.copyCsv}
          </button>
          <button
            type="button"
            className="miot-qw-button"
            onClick={() => onCopy(JSON.stringify(preview.rows, null, 2))}
          >
            {labels.copyJson}
          </button>
        </span>
      </header>
      {preview.warnings.map((warning) => (
        <p key={warning} className="miot-qw-warning">
          {warning}
        </p>
      ))}
      {shown.length < preview.rows.length && (
        <p className="miot-qw-muted">
          {fill(labels.showingRows, {
            shown: shown.length.toLocaleString(locale),
            total: preview.rows.length.toLocaleString(locale),
          })}
        </p>
      )}
      <div className="miot-qw-results__scroll">
        <table className="miot-qw-table">
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column.name} scope="col">
                  <span>{column.name}</span>
                  <span className="miot-qw-tree__type">{column.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              // Rows have no identity of their own.
              <tr key={index}>
                {preview.columns.map((column) => (
                  <td
                    key={column.name}
                    data-null={row[column.name] === null || undefined}
                  >
                    {row[column.name] === null
                      ? "null"
                      : text(row[column.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
