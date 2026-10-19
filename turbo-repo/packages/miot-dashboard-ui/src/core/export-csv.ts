type ResolveValueFn = (
  key: string,
  row: Record<string, string>,
  rowIdx: number,
  totalRows: number,
) => string;

type ResolveLabelFn = (key: string) => string;

const DELIMITER = ";";

/** Escape a cell value for CSV: wrap in quotes if it contains the delimiter, quotes, or newlines. */
function escapeCell(raw: string): string {
  const trimmed = raw.trimStart();
  const numeric = /^[+-]?\d+(?:\.\d+)?$/.test(trimmed);
  const formula = ["=", "+", "-", "@"].includes(trimmed.charAt(0)) && !numeric;
  const value =
    formula ||
    raw.startsWith("\t") ||
    raw.startsWith("\r") ||
    raw.startsWith("\n")
      ? `'${raw}`
      : raw;
  if (
    value.includes(DELIMITER) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Build a semicolon-delimited CSV string from dashlet columns and rows.
 * Uses the same `resolveValue` / `resolveLabel` functions provided by `useCompiledColumns`,
 * so Handlebars templates are resolved to their display values.
 */
export function buildCsvContent(
  columns: readonly { readonly key: string }[],
  rows: readonly Record<string, string>[],
  resolveValue: ResolveValueFn,
  resolveLabel: ResolveLabelFn,
): string {
  if (rows.length === 0) return "";

  const headerLine = columns
    .map((col) => escapeCell(resolveLabel(col.key)))
    .join(DELIMITER);

  const dataLines = rows.map((row, rowIdx) =>
    columns
      .map((col) => escapeCell(resolveValue(col.key, row, rowIdx, rows.length)))
      .join(DELIMITER),
  );

  return [headerLine, ...dataLines].join("\n");
}
