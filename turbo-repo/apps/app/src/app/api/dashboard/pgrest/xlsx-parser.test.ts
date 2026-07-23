import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseSpreadsheetBuffer } from "./xlsx-parser";

describe("parseSpreadsheetBuffer", () => {
  it("reads headers and typed cell values from an xlsx workbook", async () => {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([
      ["vehicle", "distance", "active"],
      ["TRCG73", 1234.5, true],
    ]);
    utils.book_append_sheet(workbook, sheet, "Telemetry");

    const buffer = write(workbook, { bookType: "xlsx", type: "array" });
    const parsed = await parseSpreadsheetBuffer(buffer);

    expect(parsed.headers).toEqual(["vehicle", "distance", "active"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.fields).toEqual({
      vehicle: "TRCG73",
      distance: "1234.5",
      active: "true",
    });
  });
});
