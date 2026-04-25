/** Shape of a row sanitized off the wire for /validate and /bulk. */
export interface SanitizedRow {
  index: number;
  fields: Record<string, string>;
}

/** Coerce a wire value to a string field. Objects/arrays are dropped to
 *  empty strings rather than serialized — `[object Object]` is never useful
 *  payload data and would otherwise mask client-side bugs that leak nested
 *  objects through. Null/undefined collapse to empty as well. */
function coerceToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function toFieldsRecord(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    fields[k] = coerceToString(v);
  }
  return fields;
}

/** Take an unknown JSON payload and produce a list of `{ index, fields }`
 *  rows. Anything malformed at the row level is skipped silently — the
 *  caller produces per-row results, so partial input still yields useful
 *  output. */
export function sanitizeRows(raw: unknown): SanitizedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const rec = r as { index?: unknown; fields?: unknown };
    if (typeof rec.index !== "number") continue;
    const fields = toFieldsRecord(rec.fields);
    if (!fields) continue;
    out.push({ index: rec.index, fields });
  }
  return out;
}
