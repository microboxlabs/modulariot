import type { z } from "zod";
import type {
  DuplicateStrategy,
  ParsedRow,
  RowStatus,
  SubmitFn,
} from "./types";
import { buildPgrestFetch } from "../../common/pgrest-utils";
import type { PgrestParam } from "../../common/pgrest-types";
import { validateRow } from "./validator";

const CACHE_PREFIX = "batch-importer-cache:";
const RESOLVED = new Set<RowStatus>(["processed", "updated", "skipped"]);
const ALL_STATUSES = new Set<RowStatus>([
  "unprocessed",
  "processed",
  "updated",
  "skipped",
  "failed",
  "wait",
]);

export function isResolved(status: RowStatus): boolean {
  return RESOLVED.has(status);
}

/** Bump when the shape changes; older blobs are ignored on read so stale
 *  numeric-index caches from pre-fingerprint versions don't pollute lookups. */
const CACHE_VERSION = 2 as const;

export interface CacheBlob {
  version: typeof CACHE_VERSION;
  status: Record<string, RowStatus>;
  errorlog: Record<string, string>;
}

function emptyCache(): CacheBlob {
  return { version: CACHE_VERSION, status: {}, errorlog: {} };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sanitizeCache(raw: unknown): CacheBlob {
  if (!isPlainObject(raw) || raw.version !== CACHE_VERSION) return emptyCache();
  const status: Record<string, RowStatus> = {};
  const errorlog: Record<string, string> = {};
  if (isPlainObject(raw.status)) {
    for (const [k, v] of Object.entries(raw.status)) {
      if (typeof v === "string" && ALL_STATUSES.has(v as RowStatus)) {
        status[k] = v as RowStatus;
      }
    }
  }
  if (isPlainObject(raw.errorlog)) {
    for (const [k, v] of Object.entries(raw.errorlog)) {
      if (typeof v === "string") errorlog[k] = v;
    }
  }
  return { version: CACHE_VERSION, status, errorlog };
}

export function readCache(key: string): CacheBlob {
  if (typeof localStorage === "undefined") return emptyCache();
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return emptyCache();
    return sanitizeCache(JSON.parse(raw));
  } catch {
    return emptyCache();
  }
}

export function writeCache(key: string, cache: CacheBlob) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cache));
  } catch {
    // QuotaExceededError / private-mode / disabled storage. Persistence is
    // best-effort; the in-memory UI state is authoritative within a session.
  }
}

export function clearCache(key: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CACHE_PREFIX + key);
}

export function clearFailed(key: string) {
  const cache = readCache(key);
  for (const k of Object.keys(cache.status)) {
    if (cache.status[k] === "failed") {
      delete cache.status[k];
      delete cache.errorlog[k];
    }
  }
  writeCache(key, cache);
}

function rowToParams(
  row: ParsedRow,
  _strategy: DuplicateStrategy,
  allowedFields?: ReadonlySet<string>,
): PgrestParam[] {
  const entries = Object.entries(row.fields);
  const filtered = allowedFields
    ? entries.filter(([key]) => allowedFields.has(key))
    : entries;
  return filtered.map(([key, value]) => ({ key, value }));
}

const SUCCESS_STATUSES = new Set<RowStatus>([
  "processed",
  "updated",
  "skipped",
]);

function coerceStatus(
  body: unknown,
  fallback: RowStatus = "processed",
): RowStatus {
  if (body && typeof body === "object" && "status" in body) {
    const s = (body as { status?: unknown }).status;
    if (typeof s === "string" && SUCCESS_STATUSES.has(s as RowStatus)) {
      return s as RowStatus;
    }
  }
  return fallback;
}

/**
 * Build a row-level submit that POSTs each row as JSON to a PostgREST RPC.
 *
 * Contract with the backend:
 *   - Body: `{ [header]: value, ..., _duplicateStrategy: "upsert"|"skip"|"create" }`
 *   - 2xx → row is considered successful. If the response body includes
 *     `{ "status": "processed" | "updated" | "skipped" }`, that value is
 *     used; otherwise the row is marked `processed`.
 *   - Non-2xx → row fails with the response body's `error` field or the
 *     HTTP status text.
 */
export function makePgrestSubmit(
  functionName: string,
  dataSourceId?: string,
  allowedFields?: ReadonlySet<string>,
): SubmitFn {
  return async (row, strategy) => {
    const { url, init } = buildPgrestFetch(
      functionName,
      "POST",
      rowToParams(row, strategy, allowedFields),
      dataSourceId,
    );
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        return {
          status: "failed" as const,
          errorMessage:
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
        };
      }
      const body = await res.json().catch(() => null);
      return { status: coerceStatus(body) };
    } catch (err) {
      return {
        status: "failed" as const,
        errorMessage: err instanceof Error ? err.message : "Network error",
      };
    }
  };
}

/**
 * Wrap a submit function with schema validation. Rows that fail the schema
 * short-circuit to `failed` locally, never hitting the network.
 */
export function withValidation(
  inner: SubmitFn,
  schema: z.ZodType<Record<string, unknown>>,
): SubmitFn {
  return async (row, strategy) => {
    const err = validateRow(row.fields, schema);
    if (err) return { status: "failed" as const, errorMessage: err };
    return inner(row, strategy);
  };
}

export type { SubmitResult } from "./types";
