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
        limit: { type: ["integer", "string"] },
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

  it.each(["pattern", "patternProperties"])(
    "rejects the backend-reserved parameter name %s",
    (name) => {
      expect(
        bigQueryFormError({ ...FORM, parameters: [{ name, type: "STRING" }] })
      ).toBe("bigquery.errors.parameterReserved");
    }
  );

  it("enforces the complete UTF-8 schema budget, including metadata", () => {
    const form = { ...FORM, sql: "SELECT 1 /**/" };
    const size = new TextEncoder().encode(
      JSON.stringify(buildBigQueryOperation(form).requestSchema)
    ).length;
    const padding = "a".repeat(65_536 - size);
    expect(
      bigQueryFormError({ ...form, sql: `SELECT 1 /*${padding}*/` })
    ).toBeNull();
    expect(
      bigQueryFormError({ ...form, sql: `SELECT 1 /*${padding}a*/` })
    ).toBe("bigquery.errors.size");
    expect(
      bigQueryFormError({ ...form, sql: `SELECT 1 /*${"á".repeat(40_000)}*/` })
    ).toBe("bigquery.errors.size");
  });

  it("rejects more parameters than the execution boundary accepts", () => {
    const parameters = Array.from({ length: 101 }, (_, i) => ({
      name: `p${i}`,
      type: "STRING" as const,
    }));
    expect(bigQueryFormError({ ...FORM, parameters })).toBe(
      "bigquery.errors.parameterLimit"
    );
  });
});

it("permits precision-preserving scalar strings for INT64 and NUMERIC", () => {
  const operation = buildBigQueryOperation({
    ...FORM,
    parameters: [
      { name: "large", type: "INT64" },
      { name: "decimal", type: "NUMERIC" },
      { name: "approximate", type: "FLOAT64" },
    ],
  });
  expect(operation.requestSchema.properties).toEqual({
    large: { type: ["integer", "string"] },
    decimal: { type: ["number", "string"] },
    approximate: { type: "number" },
  });
  expect(operation.requestSchema["x-dashboard"]).toMatchObject({
    parameterTypes: {
      large: "INT64",
      decimal: "NUMERIC",
      approximate: "FLOAT64",
    },
  });
});

describe("bigQueryQueries", () => {
  it("does not render objects as query text", () => {
    const operation = buildBigQueryOperation(FORM);
    operation.requestSchema["x-dashboard"] = {
      kind: "BIGQUERY",
      projectId: {},
      location: {},
      query: {},
    };
    expect(bigQueryQueries([{ id: "demo", ...operation }])[0]).toMatchObject({
      projectId: "",
      location: "",
      sql: "",
    });
  });
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
