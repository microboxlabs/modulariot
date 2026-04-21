export type RowStatus =
  | "unprocessed"
  | "processed"
  | "updated"
  | "skipped"
  | "failed"
  | "wait";

export type DuplicateStrategy = "create" | "upsert" | "skip";

export interface ParsedRow {
  index: number;
  /** Deterministic hash of the row's fields — stable across re-uploads of the
   *  same content, independent of row position. Used as the cache key so the
   *  "already processed" skip logic survives edits that reorder rows but is
   *  also not fooled by a completely different document sharing a sourceKey. */
  fingerprint: string;
  status: RowStatus;
  errorMessage?: string;
  fields: Record<string, string>;
}

export interface ParsedDocument {
  headers: string[];
  rows: ParsedRow[];
  headerError?: string;
}

export interface SubmitResult {
  status: RowStatus;
  errorMessage?: string;
}

export type SubmitFn = (
  row: ParsedRow,
  strategy: DuplicateStrategy,
) => Promise<SubmitResult>;
