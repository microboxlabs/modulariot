import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
  parseIntEnv,
  resolvePgrestCredentials,
} from "../../shared";
import { sanitizeRows, type SanitizedRow } from "../../sanitize";
import {
  buildRowBody,
  sanitizeSourceMeta,
  type IncomingSourceMeta,
  type MetaFields,
} from "../../row-body";
import { buildAuthHeader } from "@/app/api/data-sources/resolve-credentials";
import { logger } from "@/lib/logger";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;
const DEFAULT_BULK_CONCURRENCY = 10;
const DEFAULT_BULK_ROW_TIMEOUT_MS = 30_000;

const BULK_CONCURRENCY = parseIntEnv(
  process.env.PGREST_BULK_CONCURRENCY,
  DEFAULT_BULK_CONCURRENCY,
);
const BULK_ROW_TIMEOUT_MS = parseIntEnv(
  process.env.PGREST_BULK_ROW_TIMEOUT_MS,
  DEFAULT_BULK_ROW_TIMEOUT_MS,
);

type RouteContext = { params: Promise<{ functionName: string }> };

interface BulkBody {
  rows?: unknown;
  /** Source provenance produced by /parse. Forwarded by the client; the
   *  server uses these as-is — they're informational, not security-sensitive. */
  sourceMeta?: IncomingSourceMeta;
}

interface ResultLine {
  index: number;
  status: "processed" | "updated" | "skipped" | "failed";
  errorMessage?: string;
}

const SUCCESS_STATUSES = new Set(["processed", "updated", "skipped"]);

function coerceStatus(body: unknown): "processed" | "updated" | "skipped" {
  if (body && typeof body === "object" && "status" in body) {
    const s = (body as { status?: unknown }).status;
    if (typeof s === "string" && SUCCESS_STATUSES.has(s)) {
      return s as "processed" | "updated" | "skipped";
    }
  }
  return "processed";
}

async function submitOne(
  row: SanitizedRow,
  rpcUrl: string,
  authHeader: string,
  allowed: ReadonlySet<string> | null,
  meta: MetaFields,
  signal: AbortSignal,
): Promise<ResultLine> {
  const body = buildRowBody(row, allowed, meta);

  // Combine the client-disconnect signal with a per-row timeout so a hung
  // PostgREST can't keep a worker slot pinned indefinitely. Either source
  // aborts the fetch; on resolution the slot frees naturally.
  const rowSignal = AbortSignal.any([signal, AbortSignal.timeout(BULK_ROW_TIMEOUT_MS)]);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: rowSignal,
    });

    if (!res.ok) {
      const errBody = await res
        .json()
        .catch(() => ({ error: res.statusText }));
      return {
        index: row.index,
        status: "failed",
        errorMessage:
          (errBody as { error?: string }).error ?? `HTTP ${res.status}`,
      };
    }

    const okBody = await res.json().catch(() => null);
    return { index: row.index, status: coerceStatus(okBody) };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    // `AbortSignal.timeout` rejects with a DOMException whose name is
    // "TimeoutError"; client cancel produces "AbortError". Distinguish so
    // the user sees a meaningful error per row.
    if (name === "TimeoutError") {
      return {
        index: row.index,
        status: "failed",
        errorMessage: `Timed out after ${BULK_ROW_TIMEOUT_MS}ms`,
      };
    }
    if (name === "AbortError") {
      return { index: row.index, status: "failed", errorMessage: "Aborted" };
    }
    return {
      index: row.index,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { functionName } = await ctx.params;
  if (!PGREST_PATH_REGEX.test(functionName)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as BulkBody | null;
  const rows = sanitizeRows(body?.rows);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows to import." },
      { status: 400 },
    );
  }

  // Build the metadata bundle once per request: trust-critical fields come
  // from the authenticated session + counted rows. Deployment-wide fields
  // (timezone, client_id, schema_version) live in `row-body.ts` and are
  // composed in via `buildRowBody`.
  const meta: MetaFields = {
    source: sanitizeSourceMeta(body?.sourceMeta),
    uploadedBy: session.user?.email ?? "",
    totalRows: rows.length,
  };

  const dataSourceId = parseDataSourceParam(req);
  const creds = await resolvePgrestCredentials(session, dataSourceId);
  if (creds instanceof NextResponse) return creds;

  // Best-effort introspection — skip server-side filtering when the spec
  // is unreachable (the client already filters by the same allowedFields
  // it received from /parse).
  let allowed: ReadonlySet<string> | null = null;
  try {
    const spec = await fetchPgrestSpec(dataSourceId);
    if (!(spec instanceof NextResponse)) {
      const introspected = introspectPath(spec, functionName);
      if (introspected) {
        allowed = new Set(introspected.parameters.map((p) => p.name));
      }
    }
  } catch (err) {
    logger.warn({ err }, "pgrest/bulk: introspection failed, skipping field filter");
  }

  const rpcUrl = `${creds.baseUrl}/${functionName}`;
  const authHeader = buildAuthHeader(creds.token, creds.authMethod);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: ResultLine) => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };

      let next = 0;
      const total = rows.length;
      const runOne = async (): Promise<void> => {
        while (next < total) {
          if (req.signal.aborted) return;
          const i = next++;
          const result = await submitOne(
            rows[i],
            rpcUrl,
            authHeader,
            allowed,
            meta,
            req.signal,
          );
          if (req.signal.aborted) return;
          emit(result);
        }
      };

      const concurrency = Math.max(
        1,
        Math.min(BULK_CONCURRENCY, total),
      );
      const workers: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) workers.push(runOne());

      try {
        await Promise.all(workers);
      } catch (err) {
        logger.error({ err }, "pgrest/bulk: worker pool failed");
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed (e.g. on abort) — ignore.
        }
      }
    },
    cancel() {
      // Client disconnected; AbortController on the outer fetch calls
      // cascades into in-flight submitOne via req.signal. Nothing more
      // to do here.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      // Hint to nginx not to buffer streaming responses.
      "X-Accel-Buffering": "no",
    },
  });
}
