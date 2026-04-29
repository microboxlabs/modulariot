import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchPgrestSpec,
  introspectPath,
  parseDataSourceParam,
} from "../../shared";
import { sanitizeRows } from "../../sanitize";
import {
  buildMetaBody,
  buildRowBody,
  sanitizeSourceMeta,
  type IncomingSourceMeta,
  type MetaFields,
} from "../../row-body";
import { logger } from "@/lib/logger";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;
/** Cap on rows returned by /preview. The endpoint is for inspection, not bulk
 *  export — at most this many enriched bodies come back so a 4000-row import
 *  doesn't accidentally serialize everything. */
const MAX_PREVIEW_ROWS = 5;

type RouteContext = { params: Promise<{ functionName: string }> };

interface PreviewBody {
  rows?: unknown;
  sourceMeta?: IncomingSourceMeta;
  /** How many rows to enrich and return (capped at MAX_PREVIEW_ROWS). */
  limit?: unknown;
}

function clampLimit(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(MAX_PREVIEW_ROWS, Math.trunc(raw)));
}

/**
 * Dry-run companion to /bulk: assembles the *exact* JSON body that /bulk
 * would POST to PostgREST for the first N rows, but doesn't call PostgREST.
 * Lets the user inspect the enriched payload (user fields + injected audit
 * metadata) before committing to an import.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { functionName } = await ctx.params;
  if (!PGREST_PATH_REGEX.test(functionName)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as PreviewBody | null;
  const rows = sanitizeRows(body?.rows);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows to preview." },
      { status: 400 },
    );
  }

  // Same allowed-set introspection as /bulk so the preview reflects the
  // exact filter that would run during a real import. Failures here are
  // non-fatal — fall back to "no filter" to match /bulk's behavior.
  let allowed: ReadonlySet<string> | null = null;
  try {
    const spec = await fetchPgrestSpec(parseDataSourceParam(req));
    if (!(spec instanceof NextResponse)) {
      const introspected = introspectPath(spec, functionName);
      if (introspected) {
        allowed = new Set(introspected.parameters.map((p) => p.name));
      }
    }
  } catch (err) {
    logger.warn(
      { err },
      "pgrest/preview: introspection failed, skipping field filter",
    );
  }

  const meta: MetaFields = {
    source: sanitizeSourceMeta(body?.sourceMeta),
    uploadedBy: session.user?.email ?? "",
    totalRows: rows.length,
  };

  const limit = clampLimit(body?.limit);
  const previews = rows.slice(0, limit).map((row) => {
    const enriched = buildRowBody(row, allowed, meta);
    // Build the metadata block with `allowed=null` so we can surface the
    // *intent* — what the server tried to inject — separately from what
    // actually survives the RPC schema filter. Lets the user see, e.g., that
    // p_client_id is configured but their RPC doesn't declare it yet.
    const fullMeta = buildMetaBody(meta, row.index, null);
    const droppedMeta = Object.keys(fullMeta).filter((k) => !(k in enriched));
    return {
      index: row.index,
      body: enriched,
      meta: fullMeta,
      droppedMeta,
    };
  });

  return NextResponse.json({
    /** Identical filter the real import will apply, surfaced so the UI can
     *  explain why a field is missing from the preview. */
    allowedFields: allowed ? Array.from(allowed) : null,
    totalRows: rows.length,
    previews,
  });
}
