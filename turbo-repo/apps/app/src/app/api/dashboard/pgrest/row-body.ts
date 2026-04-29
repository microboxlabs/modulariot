import { parseStringEnv } from "./shared";
import type { SanitizedRow } from "./sanitize";

/** Default timezone stamped on every imported row when the env var is unset.
 *  Picked at module init; override with `DASHLET_INGESTION_TIMEZONE`. */
const DEFAULT_TIMEZONE = "America/Santiago";

const META_TIMEZONE = parseStringEnv(
  process.env.DASHLET_INGESTION_TIMEZONE,
  DEFAULT_TIMEZONE,
);
const META_CLIENT_ID = parseStringEnv(
  process.env.DASHLET_INGESTION_CLIENT_ID,
  "",
);
const META_SCHEMA_VERSION = parseStringEnv(
  process.env.DASHLET_INGESTION_SCHEMA_VERSION,
  "",
);

export interface IncomingSourceMeta {
  type?: unknown;
  name?: unknown;
  hash?: unknown;
}

/** Sanitized provenance bundle ready for per-row injection. Strings only —
 *  arbitrary client input is coerced (or dropped) so we never serialize
 *  objects/numbers/etc. into PostgREST RPC arguments. */
export interface SourceMeta {
  type: string;
  name: string;
  hash: string;
}

const VALID_SOURCE_TYPES = new Set(["excel", "csv", "paste"]);

function pickString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function sanitizeSourceMeta(
  raw: IncomingSourceMeta | undefined,
): SourceMeta {
  const type = pickString(raw?.type);
  return {
    type: VALID_SOURCE_TYPES.has(type) ? type : "",
    name: pickString(raw?.name),
    hash: pickString(raw?.hash),
  };
}

export interface MetaFields {
  source: SourceMeta;
  uploadedBy: string;
  totalRows: number;
}

/** Build the audit-metadata block injected on every row. Trust-critical
 *  values — `p_uploaded_by`, `p_total_rows`, `p_row_number` — come from
 *  server-side context (session + request count + row index) so the client
 *  cannot forge them. The `allowed` set still gates everything: if the RPC
 *  doesn't declare a given `p_*` parameter it's silently dropped, so this
 *  block is safe to append against endpoints that haven't opted in.
 *  Exported so /preview can compute the *unfiltered* version (allowed=null)
 *  and show the user which fields are being dropped by their RPC schema. */
export function buildMetaBody(
  meta: MetaFields,
  rowIndex: number,
  allowed: ReadonlySet<string> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: string) => {
    if (!value) return;
    if (allowed && !allowed.has(key)) return;
    out[key] = value;
  };
  put("p_uploaded_by", meta.uploadedBy);
  put("p_source_type", meta.source.type);
  put("p_source_name", meta.source.name);
  put("p_source_hash", meta.source.hash);
  put("p_timezone", META_TIMEZONE);
  put("p_client_id", META_CLIENT_ID);
  put("p_schema_version", META_SCHEMA_VERSION);
  if (!allowed || allowed.has("p_total_rows")) {
    out.p_total_rows = String(meta.totalRows);
  }
  if (!allowed || allowed.has("p_row_number")) {
    out.p_row_number = String(rowIndex + 1);
  }
  return out;
}

/** Compose the exact JSON body POSTed to PostgREST for a single row. Filters
 *  user fields through the `allowed` set, then layers audit metadata on top
 *  (server-stamped fields win on key collisions). Used by both /bulk's
 *  `submitOne` and /preview's dry-run inspection so they can never diverge. */
export function buildRowBody(
  row: SanitizedRow,
  allowed: ReadonlySet<string> | null,
  meta: MetaFields,
): Record<string, string> {
  const body: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.fields)) {
    if (v == null || v === "") continue;
    if (allowed && !allowed.has(k)) continue;
    body[k] = v;
  }
  Object.assign(body, buildMetaBody(meta, row.index, allowed));
  return body;
}
