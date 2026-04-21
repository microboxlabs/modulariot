import type {
  DuplicateStrategy,
  ParsedRow,
  RowStatus,
  SubmitFn,
  SubmitResult,
} from "./types";
import { buildPgrestFetch } from "../../common/pgrest-utils";
import type { PgrestParam } from "../../common/pgrest-types";

const CACHE_PREFIX = "batch-importer-cache:";
const RESOLVED: RowStatus[] = ["processed", "updated", "skipped"];

export function isResolved(status: RowStatus): boolean {
  return RESOLVED.includes(status);
}

export interface CacheBlob {
  status: Record<number, RowStatus>;
  errorlog: Record<number, string>;
}

export function readCache(key: string): CacheBlob {
  if (typeof localStorage === "undefined") return { status: {}, errorlog: {} };
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return { status: {}, errorlog: {} };
    return JSON.parse(raw) as CacheBlob;
  } catch {
    return { status: {}, errorlog: {} };
  }
}

export function writeCache(key: string, cache: CacheBlob) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cache));
}

export function clearCache(key: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CACHE_PREFIX + key);
}

export function clearFailed(key: string) {
  const cache = readCache(key);
  Object.keys(cache.status).forEach((k) => {
    if (cache.status[Number(k)] === "failed") {
      delete cache.status[Number(k)];
      delete cache.errorlog[Number(k)];
    }
  });
  writeCache(key, cache);
}

function rowToParams(
  row: ParsedRow,
  strategy: DuplicateStrategy,
): PgrestParam[] {
  const out: PgrestParam[] = Object.entries(row.fields).map(([key, value]) => ({
    key,
    value,
  }));
  out.push({ key: "_duplicateStrategy", value: strategy });
  return out;
}

const SUCCESS_STATUSES: readonly RowStatus[] = [
  "processed",
  "updated",
  "skipped",
];

function coerceStatus(
  body: unknown,
  fallback: RowStatus = "processed",
): RowStatus {
  if (body && typeof body === "object" && "status" in body) {
    const s = (body as { status?: unknown }).status;
    if (typeof s === "string" && SUCCESS_STATUSES.includes(s as RowStatus)) {
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
): SubmitFn {
  return async (row, strategy) => {
    const { url, init } = buildPgrestFetch(
      functionName,
      "POST",
      rowToParams(row, strategy),
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

export type { SubmitResult };
