import type { TableColumn } from "./column-types";

type ResolveValueFn = (
  key: string,
  row: Record<string, string>,
  rowIdx: number,
  totalRows: number
) => string;

type ResolveLabelFn = (key: string) => string;

const DELIMITER = ";";

/** Escape a cell value for CSV: wrap in quotes if it contains the delimiter, quotes, or newlines. */
function escapeCell(value: string): string {
  if (
    value.includes(DELIMITER) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a semicolon-delimited CSV string from dashlet columns and rows.
 * Uses the same `resolveValue` / `resolveLabel` functions provided by `useCompiledColumns`,
 * so Handlebars templates are resolved to their display values.
 */
export function buildCsvContent(
  columns: TableColumn[],
  rows: Record<string, string>[],
  resolveValue: ResolveValueFn,
  resolveLabel: ResolveLabelFn
): string {
  if (rows.length === 0) return "";

  const headerLine = columns
    .map((col) => escapeCell(resolveLabel(col.key)))
    .join(DELIMITER);

  const dataLines = rows.map((row, rowIdx) =>
    columns
      .map((col) =>
        escapeCell(resolveValue(col.key, row, rowIdx, rows.length))
      )
      .join(DELIMITER)
  );

  return [headerLine, ...dataLines].join("\n");
}

/** Trigger a CSV file download in the browser. */
export function downloadCsv(csvContent: string, filename: string): void {
  const safeName = filename.replace(/[/\\:*?"<>|]/g, "_");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}
