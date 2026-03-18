import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";

/** Coerce every value in a row to a string so downstream .localeCompare() is safe. */
function stringifyValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v as string | number | boolean);
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = stringifyValue(v);
  }
  return out;
}

/**
 * Parse a dynamic API / PGREST response into a row array.
 *
 * When `singleObjectFallback` is true (default: false), an object that does not
 * match any known wrapper key (rows / data / results) is treated as a single
 * row.  This is appropriate for PGREST RPC responses but NOT for generic
 * dynamic-API dashlets, which should stay empty on unknown shapes.
 */
export function parseRows(
  data: unknown,
  { singleObjectFallback = false }: { singleObjectFallback?: boolean } = {},
): Record<string, string>[] {
  let raw: unknown[];

  if (Array.isArray(data)) {
    raw = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(candidate)) {
      raw = candidate;
    } else if (singleObjectFallback) {
      // Treat the object itself (or a non-array candidate) as a single row
      raw = [candidate && typeof candidate === "object" ? candidate : obj];
    } else {
      return [];
    }
  } else {
    return [];
  }

  return raw.map((r) =>
    r && typeof r === "object" ? normalizeRow(r as Record<string, unknown>) : {},
  );
}

/** Build the fetch URL and RequestInit for a PGREST RPC call. */
export function buildPgrestFetch(
  functionName: string,
  method: PgrestHttpMethod,
  params: PgrestParam[],
): { url: string; init?: RequestInit } {
  const validParams = params.filter((p) => p.key && p.value);
  const baseUrl = `/app/api/dashboard/pgrest/${encodeURIComponent(functionName.trim())}`;

  if (method === "POST") {
    const body: Record<string, string> = {};
    for (const p of validParams) body[p.key] = p.value;
    return {
      url: baseUrl,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    };
  }

  const qs = new URLSearchParams();
  for (const p of validParams) qs.set(p.key, p.value);
  const query = qs.toString();
  return { url: query ? `${baseUrl}?${query}` : baseUrl };
}
