/** RPC parameter introspection — wire-shape returned by /api/dashboard/pgrest
 *  endpoints. The same fields shape the schema panel UI and feed server-side
 *  Zod validation. */
export interface IntrospectedParam {
  name: string;
  type: string;
  format: string;
  required?: boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export type RowStatus =
  | "unprocessed"
  | "processed"
  | "updated"
  | "skipped"
  | "failed"
  | "wait";

export interface ParsedRow {
  index: number;
  /** Deterministic hash of the row's fields — stable across re-uploads of the
   *  same content, independent of row position. Used as the cache key so the
   *  "already processed" skip logic survives edits that reorder rows but is
   *  also not fooled by a completely different document sharing a sourceKey. */
  fingerprint: string;
  fields: Record<string, string>;
}

/** Mutable per-row state kept OUT of the immutable `ParsedRow` so updating one
 *  row during import doesn't require cloning the entire rows array. */
export interface RowState {
  status: RowStatus;
  errorMessage?: string;
}

export interface ParsedDocument {
  headers: string[];
  rows: ParsedRow[];
  headerError?: string;
}

