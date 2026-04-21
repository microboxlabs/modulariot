import type { ParsedDocument, ParsedRow } from "./types";

function detectDelimiter(firstLine: string): string {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return commas > tabs ? "," : "\t";
}

function tokenize(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const len = content.length;

  while (i < len) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
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
      if (c === "\r" && content[i + 1] === "\n") i += 2;
      else i++;
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
  const headers = header.map((h) => h.trim()).filter((h) => h.length > 0);

  if (headers.length === 0) {
    return { headers: [], rows: [], headerError: "no_headers" };
  }

  const rows: ParsedRow[] = dataRows.map((cells, index) => {
    const fields: Record<string, string> = {};
    headers.forEach((key, ci) => {
      fields[key] = (cells[ci] ?? "").trim();
    });
    return { index, status: "unprocessed", fields };
  });

  return { headers, rows };
}
