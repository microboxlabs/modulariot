import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";

/** Parse a dynamic API / PGREST response into a row array. */
export function parseRows(data: unknown): Record<string, string>[] {
  if (Array.isArray(data)) return data as Record<string, string>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(candidate)) return candidate as Record<string, string>[];
    if (candidate && typeof candidate === "object") {
      return [candidate as Record<string, string>];
    }
    // No known wrapper key — treat the object itself as a single row
    return [obj as Record<string, string>];
  }
  return [];
}

/** Build the fetch URL and RequestInit for a PGREST RPC call. */
export function buildPgrestFetch(
  functionName: string,
  method: PgrestHttpMethod,
  params: PgrestParam[],
): { url: string; init?: RequestInit } {
  const validParams = params.filter((p) => p.key && p.value);
  const baseUrl = `/app/api/dashboard/pgrest/${functionName.trim()}`;

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
