export interface ParsedRow {
  index: number;
  fingerprint: string;
  fields: Record<string, string>;
}

export interface ParsedDocument {
  headers: string[];
  rows: ParsedRow[];
  headerError?: string;
}

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

const FINGERPRINT_COLLATOR = new Intl.Collator("en", { sensitivity: "variant" });
const US = "\x1f";
const RS = "\x1e";

export function fingerprintRow(fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort(FINGERPRINT_COLLATOR.compare);
  let out = "";
  for (const k of keys) out += k + US + fields[k] + RS;
  return out;
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

function coerceCell(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

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
