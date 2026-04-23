import type { ParsedDocument, ParsedRow } from "./types";

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const pipes = (firstLine.match(/\|/g) || []).length;
  const max = Math.max(tabs, commas, semis, pipes);
  if (max === 0) return "\t";
  if (max === tabs) return "\t";
  if (max === commas) return ",";
  if (max === semis) return ";";
  return "|";
}

interface QuotedStep {
  append: string;
  advance: number;
  endQuote: boolean;
}

function consumeQuotedChar(content: string, pos: number): QuotedStep {
  const c = content[pos];
  if (c === '"') {
    if (content[pos + 1] === '"') {
      return { append: '"', advance: 2, endQuote: false };
    }
    return { append: "", advance: 1, endQuote: true };
  }
  return { append: c, advance: 1, endQuote: false };
}

function newlineAdvance(content: string, pos: number): number {
  return content[pos] === "\r" && content[pos + 1] === "\n" ? 2 : 1;
}

function tokenize(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const len = content.length;
  let i = 0;

  while (i < len) {
    if (inQuotes) {
      const step = consumeQuotedChar(content, i);
      cell += step.append;
      i += step.advance;
      if (step.endQuote) inQuotes = false;
      continue;
    }
    const c = content[i];
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += newlineAdvance(content, i);
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

export function parseDocument(content: string): ParsedDocument {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const grid = tokenize(content, delimiter);

  if (grid.length === 0) {
    return { headers: [], rows: [], headerError: "empty" };
  }

  const [header, ...dataRows] = grid;
  const headerEntries = header
    .map((h, index) => ({ name: h.trim(), index }))
    .filter((e) => e.name.length > 0);

  if (headerEntries.length === 0) {
    return { headers: [], rows: [], headerError: "no_headers" };
  }

  const headers = headerEntries.map((e) => e.name);

  const rows: ParsedRow[] = dataRows.map((cells, index) => {
    const fields: Record<string, string> = {};
    for (const { name, index: originalIndex } of headerEntries) {
      fields[name] = (cells[originalIndex] ?? "").trim();
    }
    return {
      index,
      fingerprint: fingerprintRow(fields),
      fields,
    };
  });

  return { headers, rows };
}

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
 *  are recomputed so cache lookups key off the effective (mapped) shape.
 *  Returns the same `doc` reference when the map is a no-op, so memoized
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
  const rows: ParsedRow[] = doc.rows.map((r) => {
    const fields: Record<string, string> = {};
    for (const h of doc.headers) fields[map[h] ?? h] = r.fields[h] ?? "";
    return { index: r.index, fingerprint: fingerprintRow(fields), fields };
  });
  return { headers: mappedHeaders, rows, headerError: doc.headerError };
}

/** Narrow a raw cell value (from xlsx / JSON / etc.) to a string. Objects and
 *  arrays collapse to empty string instead of the default `[object Object]`
 *  stringification — that default was never useful data for an import preview
 *  and masked bugs where richer cell objects leaked through. */
function coerceCell(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/**
 * Build a ParsedDocument straight from pre-split rows (e.g. from an xlsx
 * workbook). Same fingerprint + shape as parseDocument, but skips the CSV
 * tokenizer. `rows` is `[headers, ...dataRows]`; cells are coerced to strings.
 */
export function parseGrid(grid: unknown[][]): ParsedDocument {
  if (grid.length === 0) {
    return { headers: [], rows: [], headerError: "empty" };
  }
  const [header, ...dataRows] = grid;
  const headerEntries = (header ?? [])
    .map((h, index) => ({ name: coerceCell(h).trim(), index }))
    .filter((e) => e.name.length > 0);
  if (headerEntries.length === 0) {
    return { headers: [], rows: [], headerError: "no_headers" };
  }
  const headers = headerEntries.map((e) => e.name);
  const rows: ParsedRow[] = [];
  let emitted = 0;
  for (const cells of dataRows) {
    const arr = cells ?? [];
    const fields: Record<string, string> = {};
    let hasContent = false;
    for (const { name, index: originalIndex } of headerEntries) {
      const str = coerceCell(arr[originalIndex]).trim();
      if (str.length > 0) hasContent = true;
      fields[name] = str;
    }
    if (!hasContent) continue;
    rows.push({ index: emitted++, fingerprint: fingerprintRow(fields), fields });
  }
  return { headers, rows };
}
