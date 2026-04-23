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

/** Discriminated so an exception in parse/validate surfaces as a structured
 *  error response instead of hanging the pending promise on the client side. */
export type ParseResponse =
  | {
      requestId: number;
      ok: true;
      doc: ParsedDocument;
      validations: Record<number, string>;
    }
  | {
      requestId: number;
      ok: false;
      error: { message: string; stack?: string; stage?: string };
    };

const ctx = globalThis as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (e: MessageEvent<ParseRequest>) => {
  const msg = e.data;
  let stage: "parse" | "schema" | "validate" = "parse";
  try {
    const doc =
      msg.kind === "text" ? parseDocument(msg.text) : parseGrid(msg.grid);

    const validations: Record<number, string> = {};
    if (msg.params && msg.params.length > 0 && doc.rows.length > 0) {
      stage = "schema";
      const schema = buildRowSchema(msg.params);
      stage = "validate";
      for (const row of doc.rows) {
        const err = validateRow(row.fields, schema);
        if (err) validations[row.index] = err;
      }
    }

    const response: ParseResponse = {
      requestId: msg.requestId,
      ok: true,
      doc,
      validations,
    };
    ctx.postMessage(response);
  } catch (err) {
    const response: ParseResponse = {
      requestId: msg.requestId,
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        stage,
      },
    };
    ctx.postMessage(response);
  }
});
