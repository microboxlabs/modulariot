import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const spec = parse(
  readFileSync(new URL("../contract/openapi.yaml", import.meta.url), "utf8"),
);
const id = "https://schemas.example.invalid/dashboard";
const validator = new Ajv2020({ strict: false, validateFormats: false });
validator.addSchema(spec, id);
const acceptsDraft = validator.compile({
  $ref: `${id}#/components/schemas/QueryPlanDraft`,
});
const acceptsPlan = validator.compile({
  $ref: `${id}#/components/schemas/QueryPlan`,
});
const draft = {
  name: "Demo query",
  projectId: "demo-project",
  location: "US",
  sql: "SELECT 1",
  maximumBytesBilled: 1000,
  parameters: [],
};
const saved = {
  ...draft,
  id: "demo-plan",
  sourceId: "demo-source",
  revision: "demo-revision",
  updatedAt: "2026-01-01T00:00:00Z",
  columns: [{ name: "value", type: "INT64" }],
};

describe("published query authoring wire schemas", () => {
  it("accepts a real saved-plan response with both draft fields and server metadata", () => {
    expect(acceptsPlan(saved), JSON.stringify(acceptsPlan.errors)).toBe(true);
  });
  it("keeps request drafts closed against saved-plan and unknown fields", () => {
    expect(acceptsDraft(draft)).toBe(true);
    expect(acceptsDraft(saved)).toBe(false);
    expect(acceptsDraft({ ...draft, unexpected: true })).toBe(false);
  });
  it("requires saved metadata and rejects invalid content and extra fields", () => {
    expect(acceptsPlan(draft)).toBe(false);
    expect(acceptsPlan({ ...saved, maximumBytesBilled: "wrong" })).toBe(false);
    expect(acceptsPlan({ ...saved, unexpected: true })).toBe(false);
  });
});
