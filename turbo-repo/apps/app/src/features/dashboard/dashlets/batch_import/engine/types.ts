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
