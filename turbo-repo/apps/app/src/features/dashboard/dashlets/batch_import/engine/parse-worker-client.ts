import type { ParsedDocument } from "./types";
import type { IntrospectedParam } from "./validator";
import type {
  ParseRequest,
  ParseResponse,
} from "./parse-worker";
import { parseDocument, parseGrid } from "./parser";
import { buildRowSchema, validateRow } from "./validator";

export interface ParseOutcome {
  doc: ParsedDocument;
  validations: Record<number, string>;
}

interface WorkerHandle {
  worker: Worker;
  pending: Map<number, (r: ParseResponse) => void>;
  nextId: number;
}

let handle: WorkerHandle | null = null;

/** Fallback for SSR / test / browsers without Worker: do the work inline so
 *  the caller's contract is identical. */
function runInline(
  kind: "text" | "grid",
  input: string | unknown[][],
  params: IntrospectedParam[] | null,
): ParseOutcome {
  const doc =
    kind === "text"
      ? parseDocument(input as string)
      : parseGrid(input as unknown[][]);
  const validations: Record<number, string> = {};
  if (params && params.length > 0 && doc.rows.length > 0) {
    const schema = buildRowSchema(params);
    for (const row of doc.rows) {
      const err = validateRow(row.fields, schema);
      if (err) validations[row.index] = err;
    }
  }
  return { doc, validations };
}

function getHandle(): WorkerHandle | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (handle) return handle;
  try {
    const worker = new Worker(new URL("./parse-worker.ts", import.meta.url), {
      type: "module",
    });
    const pending = new Map<number, (r: ParseResponse) => void>();
    worker.addEventListener("message", (e: MessageEvent<ParseResponse>) => {
      const cb = pending.get(e.data.requestId);
      if (!cb) return;
      pending.delete(e.data.requestId);
      cb(e.data);
    });
    handle = { worker, pending, nextId: 1 };
    return handle;
  } catch {
    // Some bundlers/tests can't resolve the new-URL pattern; fall back inline.
    return null;
  }
}

function send(h: WorkerHandle, req: ParseRequest): Promise<ParseOutcome> {
  return new Promise((resolve) => {
    h.pending.set(req.requestId, (r) =>
      resolve({ doc: r.doc, validations: r.validations }),
    );
    h.worker.postMessage(req);
  });
}

export async function parseText(
  text: string,
  params: IntrospectedParam[] | null,
): Promise<ParseOutcome> {
  const h = getHandle();
  if (!h) return runInline("text", text, params);
  return send(h, { kind: "text", requestId: h.nextId++, text, params });
}

export async function parseFromGrid(
  grid: unknown[][],
  params: IntrospectedParam[] | null,
): Promise<ParseOutcome> {
  const h = getHandle();
  if (!h) return runInline("grid", grid, params);
  return send(h, { kind: "grid", requestId: h.nextId++, grid, params });
}

export function terminateParseWorker(): void {
  if (!handle) return;
  handle.worker.terminate();
  handle = null;
}
