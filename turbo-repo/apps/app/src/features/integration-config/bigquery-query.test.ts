import { describe, expect, it } from "vitest";
import { isBigQueryConnection } from "./bigquery-query";

describe("isBigQueryConnection", () => {
  it("is a template-less connection to the BigQuery API", () => {
    expect(
      isBigQueryConnection({
        baseUrl: "https://bigquery.googleapis.com/",
        templateId: null,
      })
    ).toBe(true);
    expect(
      isBigQueryConnection({
        baseUrl: "https://pgrest.example.com",
        templateId: null,
      })
    ).toBe(false);
  });
});
