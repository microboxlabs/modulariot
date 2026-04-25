import type { ParsedDocument, ParsedRow } from "./types";

const FINGERPRINT_COLLATOR = new Intl.Collator("en", { sensitivity: "variant" });
const US = "\x1f";
const RS = "\x1e";

function fingerprintRow(fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort(FINGERPRINT_COLLATOR.compare);
  let out = "";
  for (const k of keys) out += k + US + fields[k] + RS;
  return out;
}

/** Identity-safe rename of a ParsedDocument's headers (and the matching keys
 *  in each row's `fields` object). Preserves row order and index; fingerprints
 *  are recomputed so server-side correlation keys off the effective shape.
 *  Returns the same `doc` reference when the map is a no-op so memoized
 *  consumers don't re-render unnecessarily. */
export function applyHeaderMap(
  doc: ParsedDocument,
  map: Record<string, string>,
): ParsedDocument {
  if (!doc.headers.length) return doc;
  let anyChange = false;
  for (const h of doc.headers) {
    const target = map[h];
    if (target && target !== h) {
      anyChange = true;
      break;
    }
  }
  if (!anyChange) return doc;
  const mappedHeaders = doc.headers.map((h) => map[h] ?? h);
  // Detect duplicate targets — two source headers mapped to the same target
  // would silently overwrite each other inside the row `fields` object,
  // losing one column of data with no UI signal.
  const freq = new Map<string, number>();
  for (const h of mappedHeaders) freq.set(h, (freq.get(h) ?? 0) + 1);
  let hasCollision = false;
  for (const count of freq.values()) {
    if (count > 1) {
      hasCollision = true;
      break;
    }
  }
  if (hasCollision) {
    return {
      headers: doc.headers,
      rows: doc.rows,
      headerError: doc.headerError ?? "duplicate_mapping",
    };
  }
  const rows: ParsedRow[] = doc.rows.map((r) => {
    const fields: Record<string, string> = {};
    for (const h of doc.headers) fields[map[h] ?? h] = r.fields[h] ?? "";
    return { index: r.index, fingerprint: fingerprintRow(fields), fields };
  });
  return { headers: mappedHeaders, rows, headerError: doc.headerError };
}
