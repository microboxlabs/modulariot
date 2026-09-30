import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE, type DashboardQueryDefinition } from "./document";
import { validateDashboardConfig } from "./schema";

const query: DashboardQueryDefinition = {
  id: "cost-by-service",
  variableName: "costs",
  connectionId: "billing-connection",
  operationId: "cost-summary",
  parameters: {
    days: { kind: "literal", value: 30 },
    service: { kind: "filter", key: "service", defaultValue: null },
  },
};

describe("connection-backed query documents", () => {
  it("round-trips connection bindings without legacy datasource fields", () => {
    const document = { ...DEFAULT_STORAGE, queries: [query] };
    expect(validateDashboardConfig(document)).toEqual({
      valid: true,
      config: document,
    });
  });

  it("preserves additive metadata on query definitions and bindings", () => {
    const definition = {
      ...query,
      label: "Costs",
      parameters: {
        days: { kind: "literal", value: 30, hint: "lookback" },
      },
    };
    const document = { ...DEFAULT_STORAGE, queries: [definition] };
    expect(validateDashboardConfig(document)).toEqual({
      valid: true,
      config: document,
    });
  });

  it.each([
    { parameters: { x: { kind: "filter", key: "x", omitWhenEmpty: "true" } } },
    { connectionId: "" },
    { operationId: "" },
    { parameters: { x: { kind: "expression", value: "process.env" } } },
    { parameters: { x: { kind: "literal", value: { nested: true } } } },
    { parameters: { x: { kind: "literal", value: Number.POSITIVE_INFINITY } } },
    { parameters: { x: { kind: "literal", value: "a".repeat(2049) } } },
    { parameters: { x: { kind: "literal", value: Array(101).fill("a") } } },
    { parameters: { x: { kind: "filter", key: "" } } },
  ])("rejects malformed or unbounded bindings: %j", (overrides) => {
    expect(
      validateDashboardConfig({
        ...DEFAULT_STORAGE,
        queries: [{ ...query, ...overrides }],
      }).valid,
    ).toBe(false);
  });

  it("counts supplementary Unicode characters like JSON Schema maxLength", () => {
    const within = {
      ...query,
      id: "😀".repeat(128),
      parameters: { text: { kind: "literal", value: "😀".repeat(2048) } },
    };
    expect(
      validateDashboardConfig({ ...DEFAULT_STORAGE, queries: [within] }).valid,
    ).toBe(true);
    for (const outside of [
      { ...within, id: "😀".repeat(129) },
      {
        ...within,
        parameters: { text: { kind: "literal", value: "😀".repeat(2049) } },
      },
    ]) {
      expect(
        validateDashboardConfig({ ...DEFAULT_STORAGE, queries: [outside] })
          .valid,
      ).toBe(false);
    }
  });

  it("bounds the number of queries without breaking old documents", () => {
    expect(validateDashboardConfig(DEFAULT_STORAGE).valid).toBe(true);
    expect(
      validateDashboardConfig({
        ...DEFAULT_STORAGE,
        queries: Array(51).fill(query),
      }).valid,
    ).toBe(false);
  });
});
