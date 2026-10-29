import { describe, expect, it } from "vitest";
import {
  problemFromMessage,
  queryPlanDraftSchema,
  sqlParameterNames,
  type QueryPlanDraft,
} from "./authoring";

const draft: QueryPlanDraft = {
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT day, trips FROM `fleet.daily` WHERE day >= @since",
  maximumBytesBilled: 100_000_000,
  parameters: [{ name: "since", type: "DATE", sample: "2026-10-01" }],
};

describe("queryPlanDraftSchema", () => {
  it("accepts a complete draft", () => {
    expect(queryPlanDraftSchema.parse(draft)).toEqual(draft);
  });

  it.each([
    ["an empty name", { name: " " }],
    ["a project id with capitals", { projectId: "Analytics" }],
    ["a location with spaces", { location: "us east" }],
    ["empty SQL", { sql: "  " }],
    ["a fractional byte limit", { maximumBytesBilled: 1.5 }],
    ["a zero byte limit", { maximumBytesBilled: 0 }],
    [
      "a parameter type BigQuery does not bind",
      { parameters: [{ name: "x", type: "GEOGRAPHY" }] },
    ],
    [
      "a parameter name that is not an identifier",
      { parameters: [{ name: "1x", type: "STRING" }] },
    ],
    [
      "the same parameter twice",
      {
        parameters: [
          { name: "since", type: "DATE" },
          { name: "Since", type: "DATE" },
        ],
      },
    ],
    ["an unknown field", { connectionSecret: "x" }],
  ])("refuses %s", (_label, change) => {
    expect(
      queryPlanDraftSchema.safeParse({ ...draft, ...change }).success,
    ).toBe(false);
  });
});

describe("sqlParameterNames", () => {
  it("finds each @name once", () => {
    expect(sqlParameterNames("SELECT @a, @b WHERE x = @a")).toEqual(["a", "b"]);
  });

  it("skips strings, quoted identifiers, comments and system variables", () => {
    const sql = [
      "SELECT '@no', \"@no\", `@no` -- @no",
      "# @no",
      "/* @no */ @@session.time_zone, @yes",
    ].join("\n");
    expect(sqlParameterNames(sql)).toEqual(["yes"]);
  });
});

describe("problemFromMessage", () => {
  it("reads the position BigQuery puts in brackets", () => {
    expect(problemFromMessage("Unrecognized name: dya at [3:8]")).toEqual({
      message: "Unrecognized name: dya at [3:8]",
      line: 3,
      column: 8,
    });
  });

  it("keeps a message without a position", () => {
    expect(problemFromMessage("Access Denied")).toEqual({
      message: "Access Denied",
    });
  });
});

describe("SQL source coordinates", () => {
  it("preserves leading lines and spaces so diagnostics address the editor text", () => {
    const sql = "\n\n  SELECT missing_column\n";
    expect(queryPlanDraftSchema.parse({ ...draft, sql }).sql).toBe(sql);
  });
});

describe("GoogleSQL literal parameters", () => {
  it("does not declare names inside triple quoted raw or escaped literals", () => {
    const sql = [
      "SELECT r'''we'll ignore @hidden''' AS text, @real",
      'SELECT """the "quoted" @hidden value""", @other',
      "SELECT `@identifier`, @@session.time_zone /* @comment */",
    ].join("\n");
    expect(sqlParameterNames(sql)).toEqual(["real", "other"]);
  });
});
