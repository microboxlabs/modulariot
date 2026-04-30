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
 *  cannot forge them. Filtered through the same `allowed` set as user fields:
 *  any audit param the target RPC doesn't declare in its OpenAPI signature is
 *  silently dropped, keeping calls against not-yet-migrated endpoints from
 *  failing with `function not found`. To start storing an audit field, add
 *  the matching `p_*` parameter to the RPC's `CREATE FUNCTION` signature. */
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

/** Build just the user-data half of the row body — the columns coming from
 *  the parsed file/paste, filtered through the RPC's `allowed` parameter set
 *  so unknown columns get dropped silently. Audit metadata is composed in
 *  separately by `buildRowBody` (or fetched independently by /preview). */
export function buildUserBody(
  row: SanitizedRow,
  allowed: ReadonlySet<string> | null,
): Record<string, string> {
  const body: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.fields)) {
    if (v == null || v === "") continue;
    if (allowed && !allowed.has(k)) continue;
    body[k] = v;
  }
  return body;
}

/** Compose the exact JSON body POSTed to PostgREST for a single row: the
 *  filtered user data plus the unfiltered audit metadata. Server-stamped
 *  audit fields win on key collisions so a user column named `p_uploaded_by`
 *  can't masquerade as the session email. Used by both /bulk's `submitOne`
 *  and /preview's dry-run inspection so they can never diverge. */
export function buildRowBody(
  row: SanitizedRow,
  allowed: ReadonlySet<string> | null,
  meta: MetaFields,
): Record<string, string> {
  return {
    ...buildUserBody(row, allowed),
    ...buildMetaBody(meta, row.index, allowed),
  };
}
