import { describe, expect, it, vi } from "vitest";
import { createTemplateEngine } from "./engine";
import {
  createTemplateContext,
  parseTemplateRow,
  resolveTemplateFields,
} from "./data-context";

describe("template data boundary", () => {
  it("accepts objects and first object rows while preserving JSON value types", () => {
    expect(
      parseTemplateRow('{"count":2,"enabled":true,"nested":{"name":"a"}}'),
    ).toEqual({ count: 2, enabled: true, nested: { name: "a" } });
    expect(parseTemplateRow('[{"count":3},{"count":4}]')).toEqual({ count: 3 });
  });
  it.each([
    undefined,
    "",
    "{private",
    "null",
    "2",
    '"text"',
    "[]",
    "[null]",
    "[[1]]",
    '[1,{"count":2}]',
  ])("ignores non-row data without logging: %s", (json) => {
    const error = vi.spyOn(console, "error");
    try {
      expect(parseTemplateRow(json)).toBeUndefined();
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
  it("keeps explicit namespaces ahead of colliding row fields and preserves prototypes", () => {
    const row = JSON.parse(
      '{"__proto__":"ordinary","count":3,"filter":"wrong","data_provider":"wrong","row":"wrong"}',
    ) as Record<string, unknown>;
    const filters = { site: "selected" };
    const context = createTemplateContext({
      row,
      filters,
      dataProvider: [{ key: "name", value: "host" }],
    });
    expect(context.row).toBe(row);
    expect(context.filter).toBe(filters);
    expect(context.data_provider).toEqual({ name: "host" });
    expect(context.__proto__).toBe("ordinary");
    expect(Object.getPrototypeOf(context)).toBe(Object.prototype);
    expect(row.filter).toBe("wrong");
  });
  it("resolves server/static rows, filters and provider values with an isolated host engine", () => {
    const context = createTemplateContext({
      row: { amount: 3 },
      filters: { site: "demo" },
      dataProvider: [{ key: "name", value: "Costs" }],
    });
    const fields = JSON.parse(
      '{"__proto__":"{{row.amount}}","title":"{{data_provider.name}} / {{filter.site}}","total":"{{multiply amount 2}}"}',
    ) as Record<string, string>;
    const result = resolveTemplateFields(
      fields,
      context,
      createTemplateEngine(),
    );
    expect(result.title).toBe("Costs / demo");
    expect(result.total).toBe("6");
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toBe("3");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(createTemplateContext({ filters: {} })).toEqual({ filter: {} });
  });
});
