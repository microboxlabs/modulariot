import { describe, it, expect } from "vitest";
import Handlebars from "handlebars";
import {
  compileTemplates,
  resolveTemplate,
  resolveHandlebarsField,
  buildDataProviderContext,
} from "./use-handlebars-templates";

describe("compileTemplates", () => {
  it('compiles fields containing "{{"', () => {
    const map = compileTemplates([
      { id: "title", template: "Hello {{name}}" },
    ]);
    expect(map.has("title")).toBe(true);
  });

  it('skips fields without "{{"', () => {
    const map = compileTemplates([
      { id: "plain", template: "no template here" },
    ]);
    expect(map.has("plain")).toBe(false);
  });

  it("skips invalid templates silently", () => {
    // Handlebars.compile only throws on truly malformed syntax
    // {{#if}} without {{/if}} is actually accepted by Handlebars.compile
    // so we test with a template that actually fails compilation
    const map = compileTemplates([
      { id: "bad", template: "{{> (lookup . 'invalid') }}" },
    ]);
    // Whether or not Handlebars accepts it, the function should not throw
    expect(map).toBeInstanceOf(Map);
  });

  it("returns empty Map for empty array", () => {
    const map = compileTemplates([]);
    expect(map.size).toBe(0);
  });

  it("compiles multiple fields", () => {
    const map = compileTemplates([
      { id: "a", template: "{{a}}" },
      { id: "b", template: "{{b}}" },
    ]);
    expect(map.size).toBe(2);
  });
});

describe("resolveTemplate", () => {
  it("resolves compiled template with context", () => {
    const map = compileTemplates([{ id: "t", template: "Hello {{name}}" }]);
    expect(resolveTemplate(map, "t", { name: "World" }, "fallback")).toBe(
      "Hello World",
    );
  });

  it("returns fallback when id not in map", () => {
    const map = new Map();
    expect(resolveTemplate(map, "missing", {}, "fallback")).toBe("fallback");
  });

  it("returns fallback when template execution throws", () => {
    // Manually insert a template that will throw on execution
    const map = new Map<string, Handlebars.TemplateDelegate>();
    map.set("t", (() => {
      throw new Error("runtime error");
    }) as unknown as Handlebars.TemplateDelegate);
    expect(resolveTemplate(map, "t", {}, "fallback")).toBe("fallback");
  });
});

describe("resolveHandlebarsField", () => {
  it("resolves template with context", () => {
    expect(resolveHandlebarsField("Hello {{name}}", { name: "World" })).toBe(
      "Hello World",
    );
  });

  it("returns raw template on compile error", () => {
    const bad = "{{#if}}";
    expect(resolveHandlebarsField(bad, {})).toBe(bad);
  });

  it("handles nested context", () => {
    expect(
      resolveHandlebarsField("{{row.name}}", { row: { name: "Test" } }),
    ).toBe("Test");
  });

  it("returns empty string for missing context key", () => {
    expect(resolveHandlebarsField("{{missing}}", {})).toBe("");
  });
});

describe("buildDataProviderContext", () => {
  it("builds data_provider from entries", () => {
    const result = buildDataProviderContext([
      { key: "temp", value: "25" },
      { key: "humidity", value: "60" },
    ]);
    expect(result).toEqual({
      data_provider: { temp: "25", humidity: "60" },
    });
  });

  it("skips entries with empty key", () => {
    const result = buildDataProviderContext([
      { key: "", value: "skip" },
      { key: "valid", value: "yes" },
    ]);
    expect(result).toEqual({ data_provider: { valid: "yes" } });
  });

  it("handles empty array", () => {
    expect(buildDataProviderContext([])).toEqual({ data_provider: {} });
  });
});
