import type { ParsedDocument } from "./types";

/** Quote a CSV cell when it contains a comma, double-quote, CR, or LF.
 *  Internal double-quotes are escaped by doubling them, per RFC 4180. */
function escapeCell(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replaceAll('"', '""')}"`;
  }
  return v;
}

/** Serialize the current grid (post-rename) to CSV.
 *  - Columns follow `doc.headers` order, so any column the user mapped/renamed
 *    appears under its mapped name.
 *  - Values are taken from `row.fields[header]`; missing cells become empty.
 *  - CRLF line ending and a UTF-8 BOM make Excel open it cleanly. */
export function buildCsv(doc: ParsedDocument): string {
  const headers = doc.headers;
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of doc.rows) {
    const cells = headers.map((h) => escapeCell(row.fields[h] ?? ""));
    lines.push(cells.join(","));
  }
  return "﻿" + lines.join("\r\n");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Compact local-time stamp suitable for filenames: `YYYYMMDD-HHmmss`. */
function timestamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

/** Trigger a browser download of the CSV. Filename defaults to a timestamped
 *  `batch-import-<ts>.csv`. */
export function downloadCsv(doc: ParsedDocument, filenameBase?: string): void {
  if (
    typeof globalThis.window === "undefined" ||
    typeof globalThis.document === "undefined"
  ) {
    return;
  }
  const csv = buildCsv(doc);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = filenameBase?.trim() || "batch-import";
  a.href = url;
  a.download = `${base}-${timestamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation so the browser has time to start the download in
  // engines that read the URL after click() returns asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
