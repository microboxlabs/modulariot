/** Every text `QueryWorkbench` shows. Hosts pass their language; English is the default. */
export interface QueryWorkbenchLabels {
  source: string;
  noSources: string;
  queries: string;
  newQuery: string;
  untitled: string;
  noQueries: string;
  pickQuery: string;
  unsaved: string;
  explorer: string;
  search: string;
  refreshSchema: string;
  loadingSchema: string;
  schemaTruncated: string;
  emptyDataset: string;
  insertHint: string;
  expand: string;
  run: string;
  running: string;
  save: string;
  saving: string;
  discard: string;
  copySql: string;
  copied: string;
  duplicate: string;
  duplicateSuffix: string;
  remove: string;
  confirmRemove: string;
  cancel: string;
  settings: string;
  name: string;
  description: string;
  projectId: string;
  location: string;
  maximumBytesBilled: string;
  parameters: string;
  parameterName: string;
  parameterType: string;
  parameterSample: string;
  addParameter: string;
  addUndeclared: string;
  removeParameter: string;
  sqlPlaceholder: string;
  estimating: string;
  /** `{bytes}` is replaced. */
  willRead: string;
  /** `{bytes}` and `{limit}` are replaced. */
  overLimit: string;
  notSelect: string;
  /** `{line}` is replaced. */
  atLine: string;
  results: string;
  noResults: string;
  /** `{rows}`, `{bytes}` and `{ms}` are replaced. */
  resultSummary: string;
  cached: string;
  /** `{shown}` and `{total}` are replaced. */
  showingRows: string;
  copyCsv: string;
  copyJson: string;
  conflict: string;
  failed: string;
}

export const DEFAULT_QUERY_WORKBENCH_LABELS: QueryWorkbenchLabels = {
  source: "Source",
  noSources: "No BigQuery connection is available.",
  queries: "Queries",
  newQuery: "New query",
  untitled: "New query",
  noQueries: "No saved queries yet.",
  pickQuery: "Open a saved query or create a new one.",
  unsaved: "Unsaved changes",
  explorer: "Explorer",
  search: "Search tables and columns",
  refreshSchema: "Reload schema",
  loadingSchema: "Reading the schema…",
  schemaTruncated: "The project has more tables or columns than shown.",
  emptyDataset: "No tables",
  insertHint: "Click a name to insert it in the query",
  expand: "Show or hide",
  run: "Run",
  running: "Running…",
  save: "Save",
  saving: "Saving…",
  discard: "Discard changes",
  copySql: "Copy SQL",
  copied: "Copied",
  duplicate: "Duplicate",
  duplicateSuffix: "(copy)",
  remove: "Delete",
  confirmRemove:
    "Delete this query? Dashboards that use it stop showing its data.",
  cancel: "Cancel",
  settings: "Query settings",
  name: "Name",
  description: "Description",
  projectId: "Project",
  location: "Location",
  maximumBytesBilled: "Maximum bytes read",
  parameters: "Parameters",
  parameterName: "Name",
  parameterType: "Type",
  parameterSample: "Test value",
  addParameter: "Add parameter",
  addUndeclared: "Declare",
  removeParameter: "Remove parameter",
  sqlPlaceholder: "SELECT …",
  estimating: "Estimating…",
  willRead: "Will read {bytes}",
  overLimit: "Reads {bytes}, above the limit of {limit}",
  notSelect: "Only SELECT queries can be saved",
  atLine: "line {line}",
  results: "Results",
  noResults: "Run the query to see its rows.",
  resultSummary: "{rows} rows · {bytes} read · {ms} ms",
  cached: "from cache",
  showingRows: "Showing {shown} of {total} rows",
  copyCsv: "Copy CSV",
  copyJson: "Copy JSON",
  conflict: "Someone else saved this query. Reload it to see their version.",
  failed: "The request failed",
};

export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

/** Decimal units, as BigQuery bills. */
export function formatBytes(bytes: number, locale?: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}
