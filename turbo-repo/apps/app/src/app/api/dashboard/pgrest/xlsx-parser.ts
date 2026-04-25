import { parseGrid, type ParsedDocument } from "./parser";

const XLSX_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods"];

export function isSpreadsheetFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return XLSX_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface XlsxModule {
  read: (data: Buffer | ArrayBuffer | Uint8Array, opts: { type: "buffer" | "array" }) => {
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
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { headers: [], rows: [], headerError: "empty" };
    const sheet = wb.Sheets[firstSheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    return parseGrid(aoa);
  } catch (err) {
    console.warn("pgrest/parse: failed to parse spreadsheet", err);
    return { headers: [], rows: [], headerError: "parse_failed" };
  }
}
