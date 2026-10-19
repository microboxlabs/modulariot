import { expect, it } from "vitest";
import { buildCsvContent } from "./export-csv";
const columns = [{ key: "value" }];
const resolve = (key: string, row: Record<string, string>) => row[key] ?? "";
it("quotes delimiter/newline/quotes and protects spreadsheet formulas in cells and headers", () => {
  const csv = buildCsvContent(
    columns,
    [
      { value: 'one;"two"\nthree' },
      { value: '=HYPERLINK("https://example.com")' },
      { value: "  @SUM(1)" },
      { value: "\tformula" },
      { value: "-42" },
      { value: "+12.5" },
      { value: "-1+2" },
    ],
    resolve,
    () => "=header",
  );
  expect(csv).toBe(
    `'=header\n"one;""two""\nthree"\n"'=HYPERLINK(""https://example.com"")"\n'  @SUM(1)\n'\tformula\n-42\n+12.5\n'-1+2`,
  );
});
it("exports only supplied rows in their order using resolved labels and index context", () => {
  const rows = [{ value: "b" }, { value: "a" }];
  expect(
    buildCsvContent(
      columns,
      rows,
      (key, row, index, total) => `${row[key]} ${index}/${total}`,
      () => "Translated",
    ),
  ).toBe("Translated\nb 0/2\na 1/2");
  expect(rows).toEqual([{ value: "b" }, { value: "a" }]);
  expect(buildCsvContent(columns, [], resolve, () => "Header")).toBe("");
});
