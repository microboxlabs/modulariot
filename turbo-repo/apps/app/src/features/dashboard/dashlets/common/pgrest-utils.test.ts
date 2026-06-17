import { describe, it, expect } from "vitest";
import { parseRows, buildDataSourceParams, buildPgrestFetch } from "./pgrest-utils";
import { makePgrestParam } from "../../test-fixtures";

// ============================================================================
// parseRows
// ============================================================================

describe("parseRows", () => {
  it("returns rows from a plain array of objects", () => {
    const data = [{ a: "1" }, { a: "2" }];
    expect(parseRows(data)).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("stringifies numeric, boolean, null, and object values", () => {
    const data = [{ n: 42, b: true, nil: null, obj: { x: 1 } }];
    const rows = parseRows(data);
    expect(rows).toEqual([
      { n: "42", b: "true", nil: "", obj: '{"x":1}' },
    ]);
  });

  it("extracts from { rows: [...] }", () => {
    const data = { rows: [{ a: "1" }] };
    expect(parseRows(data)).toEqual([{ a: "1" }]);
  });

  it("extracts from { data: [...] }", () => {
    const data = { data: [{ a: "1" }] };
    expect(parseRows(data)).toEqual([{ a: "1" }]);
  });

  it("extracts from { results: [...] }", () => {
    const data = { results: [{ a: "1" }] };
    expect(parseRows(data)).toEqual([{ a: "1" }]);
  });

  it("returns [] for null input", () => {
    expect(parseRows(null)).toEqual([]);
  });

  it("returns [] for undefined input", () => {
    expect(parseRows(undefined)).toEqual([]);
  });

  it("returns [] for string input", () => {
    expect(parseRows("hello")).toEqual([]);
  });

  it("returns [] for number input", () => {
    expect(parseRows(123)).toEqual([]);
  });

  it("returns [] for object without known wrapper keys when singleObjectFallback=false", () => {
    const data = { foo: "bar", baz: 42 };
    expect(parseRows(data)).toEqual([]);
  });

  it("treats object as single row when singleObjectFallback=true", () => {
    const data = { foo: "bar", baz: 42 };
    expect(parseRows(data, { singleObjectFallback: true })).toEqual([
      { foo: "bar", baz: "42" },
    ]);
  });

  it("treats non-array candidate as single row when singleObjectFallback=true", () => {
    const data = { rows: { a: "1", b: "2" } };
    expect(parseRows(data, { singleObjectFallback: true })).toEqual([
      { a: "1", b: "2" },
    ]);
  });

  it("returns [{}] for non-object items in the array", () => {
    const data = ["not-an-object", 123];
    expect(parseRows(data)).toEqual([{}, {}]);
  });

  it("returns [] for empty array", () => {
    expect(parseRows([])).toEqual([]);
  });

  it("prefers rows over data or results", () => {
    const data = { rows: [{ a: "rows" }], data: [{ a: "data" }] };
    expect(parseRows(data)).toEqual([{ a: "rows" }]);
  });
});

// ============================================================================
// buildDataSourceParams
// ============================================================================

describe("buildDataSourceParams", () => {
  it("returns empty URLSearchParams when no dataSourceId", () => {
    const params = buildDataSourceParams();
    expect(params.toString()).toBe("");
  });

  it("returns empty URLSearchParams when dataSourceId is empty string", () => {
    const params = buildDataSourceParams("");
    expect(params.toString()).toBe("");
  });

  it("sets dataSourceId param when provided", () => {
    const params = buildDataSourceParams("ds-123");
    expect(params.get("dataSourceId")).toBe("ds-123");
  });
});

// ============================================================================
// buildPgrestFetch
// ============================================================================

describe("buildPgrestFetch", () => {
  it("POST: builds correct URL, method, headers, JSON body", () => {
    const params = [makePgrestParam({ key: "p_id", value: "123" })];
    const result = buildPgrestFetch("my_func", "POST", params);

    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func");
    expect(result.init?.method).toBe("POST");
    expect(result.init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(result.init!.body as string)).toEqual({ p_id: "123" });
  });

  it("POST: filters out params with empty key", () => {
    const params = [
      makePgrestParam({ key: "", value: "123" }),
      makePgrestParam({ key: "p_id", value: "456" }),
    ];
    const result = buildPgrestFetch("my_func", "POST", params);
    expect(JSON.parse(result.init!.body as string)).toEqual({ p_id: "456" });
  });

  it("POST: filters out params with null value", () => {
    const params = [
      makePgrestParam({ key: "p_id", value: null as unknown as string }),
      makePgrestParam({ key: "p_name", value: "test" }),
    ];
    const result = buildPgrestFetch("my_func", "POST", params);
    expect(JSON.parse(result.init!.body as string)).toEqual({ p_name: "test" });
  });

  it("POST: filters out params with empty-string value", () => {
    const params = [
      makePgrestParam({ key: "p_etapa_max", value: "" }),
      makePgrestParam({ key: "p_name", value: "test" }),
    ];
    const result = buildPgrestFetch("my_func", "POST", params);
    expect(JSON.parse(result.init!.body as string)).toEqual({ p_name: "test" });
  });

  it("POST: appends dataSourceId to query string", () => {
    const result = buildPgrestFetch("my_func", "POST", [], "ds-99");
    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func?dataSourceId=ds-99");
  });

  it("GET: builds correct URL with query params", () => {
    const params = [makePgrestParam({ key: "p_id", value: "123" })];
    const result = buildPgrestFetch("my_func", "GET", params);
    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func?p_id=123");
    expect(result.init).toBeUndefined();
  });

  it("GET: omits params with empty-string value from query string", () => {
    const params = [
      makePgrestParam({ key: "p_id", value: "123" }),
      makePgrestParam({ key: "p_etapa_max", value: "" }),
      makePgrestParam({ key: "p_solo_criticos", value: "" }),
    ];
    const result = buildPgrestFetch("my_func", "GET", params);
    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func?p_id=123");
  });

  it("GET: includes dataSourceId in query params", () => {
    const params = [makePgrestParam({ key: "p_id", value: "123" })];
    const result = buildPgrestFetch("my_func", "GET", params, "ds-99");
    expect(result.url).toContain("p_id=123");
    expect(result.url).toContain("dataSourceId=ds-99");
  });

  it("GET: returns bare URL when no params and no dataSourceId", () => {
    const result = buildPgrestFetch("my_func", "GET", []);
    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func");
  });

  it("encodes function name in URL", () => {
    const result = buildPgrestFetch("my func/test", "GET", []);
    expect(result.url).toBe("/app/api/dashboard/pgrest/my%20func%2Ftest");
  });

  it("trims whitespace from function name", () => {
    const result = buildPgrestFetch("  my_func  ", "GET", []);
    expect(result.url).toBe("/app/api/dashboard/pgrest/my_func");
  });
});
