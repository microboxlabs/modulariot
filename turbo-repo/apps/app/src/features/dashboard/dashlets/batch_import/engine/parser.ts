import type { ParsedDocument, ParsedRow } from "./types";

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return commas > tabs ? "," : "\t";
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
  // Preserve each surviving header's original column index so downstream rows
  // read from the correct cell even when the header row has empty columns.
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
      status: "unprocessed",
      fields,
    };
  });

  return { headers, rows };
}

function fingerprintRow(fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort();
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = fields[k];
  return JSON.stringify(sorted);
}
