import { describe, expect, it, vi } from "vitest";
import Handlebars from "handlebars";
import { buildDataProviderContext, createTemplateEngine } from "./engine";

describe("isolated template engines", () => {
  it("keeps host helpers independent without registering shared helpers", () => {
    const before = { ...Handlebars.helpers };
    const first = createTemplateEngine({ helpers: { hostLabel: () => "First" } });
    const second = createTemplateEngine({ helpers: { hostLabel: () => "Second" } });
    expect(first.resolveField("{{hostLabel}}", {})).toBe("First");
    expect(second.resolveField("{{hostLabel}}", {})).toBe("Second");
    expect(Handlebars.helpers).toEqual(before);
    expect(first.resolveField("{{multiply amount 2}}", { amount: 3 })).toBe("6");
  });

  it("validates syntax eagerly and keeps fallback behavior", () => {
    const engine = createTemplateEngine();
    const fields = engine.compileTemplates([
      { id: "static", template: "Plain text" },
      { id: "invalid", template: "{{#if value}}" },
      { id: "valid", template: "Value: {{value}}" },
      { id: "missingHelper", template: "{{absentHelper value}}" },
    ]);
    expect([...fields.keys()]).toEqual(["valid", "missingHelper"]);
    expect(engine.resolveTemplate(fields, "valid", { value: 42 }, "fallback")).toBe("Value: 42");
    expect(engine.resolveTemplate(fields, "invalid", {}, "fallback")).toBe("fallback");
    expect(engine.resolveTemplate(fields, "missingHelper", {}, "fallback")).toBe("fallback");
    expect(engine.resolveField("{{#if value}}", {})).toBe("{{#if value}}");
    expect(engine.resolveField("Plain text", {})).toBe("Plain text");
  });

  it("escapes interpolated text and denies inherited properties", () => {
    const engine = createTemplateEngine();
    expect(engine.resolveField("{{value}}", { value: "<script>" })).toBe("&lt;script&gt;");
    const context = Object.create({ inherited: "private" }) as Record<string, unknown>;
    context.own = "visible";
    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(engine.resolveField("{{inherited}}/{{own}}", context)).toBe("/visible");
    } finally {
      warning.mockRestore();
    }
  });

  it("preserves prototype-named data keys as own values", () => {
    const context = buildDataProviderContext([
      { key: "", value: "ignored" },
      { key: "__proto__", value: "ordinary value" },
      { key: "count", value: "1" },
      { key: "count", value: "2" },
    ]);
    expect(Object.keys(context.data_provider)).toEqual(["__proto__", "count"]);
    expect(Object.getPrototypeOf(context.data_provider)).toBe(Object.prototype);
    expect(context.data_provider.__proto__).toBe("ordinary value");
    expect(createTemplateEngine().resolveField("{{data_provider.count}}", context)).toBe("2");
  });
});
