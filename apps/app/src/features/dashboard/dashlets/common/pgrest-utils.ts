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

/** Parse a dynamic API / PGREST response into a row array. */
export function parseRows(data: unknown): Record<string, string>[] {
  let raw: unknown[];

  if (Array.isArray(data)) {
    raw = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(candidate)) {
      raw = candidate;
    } else if (candidate && typeof candidate === "object") {
      raw = [candidate];
    } else {
      // No known wrapper key — treat the object itself as a single row
      raw = [obj];
    }
  } else {
    return [];
  }

  return raw.map((r) =>
    r && typeof r === "object" ? normalizeRow(r as Record<string, unknown>) : {},
  );
}

/**
 * Build a URLSearchParams containing the `dataSourceId` query param
 * when a data source is selected (empty otherwise).
 */
export function buildDataSourceParams(
  dataSourceId?: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (dataSourceId) params.set("dataSourceId", dataSourceId);
  return params;
}

/** Build the fetch URL and RequestInit for a PGREST RPC call. */
export function buildPgrestFetch(
  functionName: string,
  method: PgrestHttpMethod,
  params: PgrestParam[],
  dataSourceId?: string
): { url: string; init?: RequestInit } {
  const validParams = params.filter((p) => p.key && p.value);
  const baseUrl = `/app/api/dashboard/pgrest/${encodeURIComponent(functionName.trim())}`;

  const dsParams = buildDataSourceParams(dataSourceId);

  if (method === "POST") {
    const body: Record<string, string> = {};
    for (const p of validParams) body[p.key] = p.value;
    const dsSuffix = dsParams.toString();
    return {
      url: dsSuffix ? `${baseUrl}?${dsSuffix}` : baseUrl,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    };
  }

  const qs = new URLSearchParams();
  for (const p of validParams) qs.set(p.key, p.value);
  for (const [k, v] of dsParams) qs.set(k, v);
  const query = qs.toString();
  return { url: query ? `${baseUrl}?${query}` : baseUrl };
}
