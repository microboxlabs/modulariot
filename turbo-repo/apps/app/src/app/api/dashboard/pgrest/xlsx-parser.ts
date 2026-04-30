import { parseGrid, type ParsedDocument } from "./parser";

const XLSX_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods"];

export function isSpreadsheetFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return XLSX_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface XlsxModule {
  read: (
    data: Buffer | ArrayBuffer | Uint8Array,
    opts: { type: "buffer" | "array"; cellDates?: boolean },
  ) => {
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

export async function parseSpreadsheetBuffer(buf: ArrayBuffer): Promise<ParsedDocument> {
  // Dynamically import SheetJS so the module load only happens when a
  // spreadsheet upload is actually parsed. Keeps cold-start cheap on this
  // route for the much more common CSV/text path.
  const mod: unknown = await import("xlsx");
  const XLSX = mod as XlsxModule;
  try {
    // raw: true returns the underlying typed values (numbers as numbers, date
    // cells as Date objects when paired with cellDates: true) instead of the
    // formatted display string. This strips currency/thousands formatting like
    // "$1,234.56" that Excel applies for display only — the cell's real value
    // is 1234.56, which the validator can coerce to a number directly.
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { headers: [], rows: [], headerError: "empty" };
    const sheet = wb.Sheets[firstSheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    return parseGrid(aoa);
  } catch (err) {
    console.warn("pgrest/parse: failed to parse spreadsheet", err);
    return { headers: [], rows: [], headerError: "parse_failed" };
  }
}
