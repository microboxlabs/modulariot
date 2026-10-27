import { describe, expect, it } from "vitest";
import {
  bigQueryFormError,
  bigQueryQueries,
  buildBigQueryOperation,
  isBigQueryConnection,
  type BigQueryQueryForm,
} from "./bigquery-query";

const FORM: BigQueryQueryForm = {
  name: " Costo por servicio ",
  projectId: "acme-analytics",
  location: "US",
  sql: "SELECT service, SUM(cost) AS cost FROM `acme-analytics.billing.daily` WHERE day >= @since GROUP BY service",
  maximumBytesBilled: 500_000_000,
  parameters: [
    { name: "since", type: "DATE" },
    { name: "limit", type: "INT64" },
  ],
};

describe("buildBigQueryOperation", () => {
  it("stores the SQL and limits in x-dashboard, with every parameter required", () => {
    const operation = buildBigQueryOperation(FORM);
    expect(operation).toMatchObject({
      name: "Costo por servicio",
      method: "POST",
      testOperation: false,
    });
    expect(operation.requestSchema).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        since: { type: "string", format: "date" },
        limit: { type: "integer" },
      },
      required: ["since", "limit"],
      "x-dashboard": {
        readOnly: true,
        kind: "BIGQUERY",
        credentialScoped: true,
        projectId: "acme-analytics",
        location: "US",
        query: FORM.sql,
        maximumBytesBilled: "500000000",
        parameterTypes: { since: "DATE", limit: "INT64" },
      },
    });
  });

  it("declares an empty closed schema for a query without parameters", () => {
    const schema = buildBigQueryOperation({
      ...FORM,
      parameters: [],
    }).requestSchema;
    expect(schema.properties).toEqual({});
    expect(schema.required).toEqual([]);
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("bigQueryFormError", () => {
  it("accepts a complete form", () => {
    expect(bigQueryFormError(FORM)).toBeNull();
  });

  it("names the first field the modulith would refuse", () => {
    expect(bigQueryFormError({ ...FORM, projectId: "Acme" })).toBe(
      "bigquery.errors.project"
    );
    expect(
      bigQueryFormError({ ...FORM, maximumBytesBilled: 2_000_000_000 })
    ).toBe("bigquery.errors.bytes");
    expect(
      bigQueryFormError({
        ...FORM,
        parameters: [
          { name: "since", type: "DATE" },
          { name: "since", type: "STRING" },
        ],
      })
    ).toBe("bigquery.errors.parameterDuplicate");
    expect(
      bigQueryFormError({
        ...FORM,
        parameters: [{ name: "1st", type: "STRING" }],
      })
    ).toBe("bigquery.errors.parameterName");
  });
});

describe("bigQueryQueries", () => {
  it("lists only the BigQuery operations", () => {
    const query = buildBigQueryOperation(FORM);
    expect(
      bigQueryQueries([
        { id: "q1", ...query },
        {
          id: "h1",
          name: "other",
          method: "GET",
          path: "/x",
          requestSchema: {},
        },
      ])
    ).toEqual([
      {
        id: "q1",
        name: "Costo por servicio",
        projectId: "acme-analytics",
        location: "US",
        sql: FORM.sql,
        parameters: ["since: DATE", "limit: INT64"],
      },
    ]);
  });
});

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
