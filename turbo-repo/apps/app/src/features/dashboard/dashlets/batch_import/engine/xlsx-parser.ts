import type { ParsedDocument } from "./types";
import { parseGrid } from "./parser";

export const XLSX_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods"];

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return XLSX_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface XlsxModule {
  read: (data: ArrayBuffer, opts: { type: "array" }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (
      sheet: unknown,
      opts: {
        header: 1;
        defval: string;
        raw: boolean;
        blankrows: boolean;
      },
    ) => unknown[][];
  };
}

/**
 * Parse a spreadsheet file into a ParsedDocument. SheetJS is ~400 KB so it's
 * dynamically imported — only paid by users who actually pick an .xlsx file.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedDocument> {
  // Narrow through XlsxModule rather than relying on `xlsx`'s published types,
  // which are broad and pull in Node typings at call sites.
  const mod: unknown = await import("xlsx");
  const XLSX = mod as XlsxModule;
  const buf = await file.arrayBuffer();
  // SheetJS throws on malformed / encrypted / zip-bombed workbooks. Without
  // this guard the exception propagates out of `void loadFile(f)` in the UI
  // and becomes an unhandled promise rejection with no feedback to the user.
  // Returning a headerError lets the existing `doc.headerError` banner in
  // the preview surface a translated, recoverable message.
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { headers: [], rows: [], headerError: "empty" };
    const sheet = wb.Sheets[firstSheetName];
    // defval: "" keeps missing cells aligned with headers; raw: false returns
    // already-formatted string values (dates, booleans) so downstream string
    // coercion is consistent with the CSV path.
    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    return parseGrid(aoa);
  } catch (err) {
    // Leave a breadcrumb for the devtools — the UI only sees the headerError.
    console.warn("batch_import: failed to parse spreadsheet file", err);
    return { headers: [], rows: [], headerError: "parse_failed" };
  }
}
