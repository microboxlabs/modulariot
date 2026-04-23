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

interface Pending {
  resolve: (r: ParseOutcome) => void;
  reject: (err: Error) => void;
}

interface WorkerHandle {
  worker: Worker;
  pending: Map<number, Pending>;
  nextId: number;
}

let handle: WorkerHandle | null = null;

/** Fallback for SSR / test / browsers without Worker, or after a worker
 *  crash: do the work inline so the caller's contract is identical. */
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

/** Reject every in-flight request and drop the handle so the next call
 *  spins up a fresh worker. Used by the `error` / `messageerror` listeners —
 *  without this, a worker crash leaves every pending promise hanging
 *  forever because nothing else will ever settle them. */
function failAllPending(h: WorkerHandle, reason: string) {
  for (const { reject } of h.pending.values()) {
    reject(new Error(reason));
  }
  h.pending.clear();
  if (handle === h) handle = null;
  try {
    h.worker.terminate();
  } catch {
    // Already terminated by the runtime after the error — ignore.
  }
}

function getHandle(): WorkerHandle | null {
  // Worker is undefined in SSR / Node test envs, which is what we really
  // guard against here — checking the global `Worker` ctor avoids a separate
  // window check and keeps us clear of environment-specific globals.
  if (typeof Worker === "undefined") {
    return null;
  }
  if (handle) return handle;
  try {
    const worker = new Worker(new URL("./parse-worker.ts", import.meta.url), {
      type: "module",
    });
    const pending = new Map<number, Pending>();
    const h: WorkerHandle = { worker, pending, nextId: 1 };
    worker.addEventListener("message", (e: MessageEvent<ParseResponse>) => {
      const cb = pending.get(e.data.requestId);
      if (!cb) return;
      pending.delete(e.data.requestId);
      cb.resolve({ doc: e.data.doc, validations: e.data.validations });
    });
    worker.addEventListener("error", (e: ErrorEvent) => {
      failAllPending(h, e.message || "parse worker error");
    });
    worker.addEventListener("messageerror", () => {
      failAllPending(h, "parse worker message deserialization failed");
    });
    handle = h;
    return handle;
  } catch {
    // Some bundlers/tests can't resolve the new-URL pattern; fall back inline.
    return null;
  }
}

function send(h: WorkerHandle, req: ParseRequest): Promise<ParseOutcome> {
  return new Promise<ParseOutcome>((resolve, reject) => {
    h.pending.set(req.requestId, { resolve, reject });
    h.worker.postMessage(req);
  });
}

export async function parseText(
  text: string,
  params: IntrospectedParam[] | null,
): Promise<ParseOutcome> {
  const h = getHandle();
  if (!h) return runInline("text", text, params);
  try {
    return await send(h, { kind: "text", requestId: h.nextId++, text, params });
  } catch {
    // Worker crashed mid-request — the error listener has already reset the
    // handle, so the next caller will get a fresh worker. Fall back to inline
    // so this caller still gets a result.
    return runInline("text", text, params);
  }
}

export async function parseFromGrid(
  grid: unknown[][],
  params: IntrospectedParam[] | null,
): Promise<ParseOutcome> {
  const h = getHandle();
  if (!h) return runInline("grid", grid, params);
  try {
    return await send(h, { kind: "grid", requestId: h.nextId++, grid, params });
  } catch {
    return runInline("grid", grid, params);
  }
}

export function terminateParseWorker(): void {
  if (!handle) return;
  handle.worker.terminate();
  handle = null;
}
