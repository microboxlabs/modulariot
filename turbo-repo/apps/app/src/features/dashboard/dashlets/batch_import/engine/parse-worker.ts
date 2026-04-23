/// <reference lib="webworker" />
/**
 * Parse + validate batch-import documents off the main thread. Paste/upload of
 * 4000+ rows otherwise blocks the tab for several seconds while Zod validates
 * each row synchronously. This worker handles both the CSV tokenization and
 * the per-row validation, then ships a plain ParsedDocument + a `validations`
 * map (rowIndex -> error string) back.
 */
import { parseDocument, parseGrid } from "./parser";
import { buildRowSchema, validateRow, type IntrospectedParam } from "./validator";
import type { ParsedDocument } from "./types";

export type ParseRequest =
  | {
      kind: "text";
      requestId: number;
      text: string;
      params: IntrospectedParam[] | null;
    }
  | {
      kind: "grid";
      requestId: number;
      grid: unknown[][];
      params: IntrospectedParam[] | null;
    };

export interface ParseResponse {
  requestId: number;
  doc: ParsedDocument;
  /** rowIndex -> newline-delimited error. Absent entries = valid. */
  validations: Record<number, string>;
}

const ctx = globalThis as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (e: MessageEvent<ParseRequest>) => {
  const msg = e.data;
  const doc =
    msg.kind === "text" ? parseDocument(msg.text) : parseGrid(msg.grid);

  const validations: Record<number, string> = {};
  if (msg.params && msg.params.length > 0 && doc.rows.length > 0) {
    const schema = buildRowSchema(msg.params);
    for (const row of doc.rows) {
      const err = validateRow(row.fields, schema);
      if (err) validations[row.index] = err;
    }
  }

  const response: ParseResponse = { requestId: msg.requestId, doc, validations };
  ctx.postMessage(response);
});
