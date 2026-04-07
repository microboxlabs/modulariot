import { describe, it, expect } from "vitest";
import {
  findHandlebarsExpressions,
  getHandlebarsStatus,
  getFlowbiteColor,
  resolveDataProperty,
} from "./handlebars-helpers";

describe("findHandlebarsExpressions", () => {
  it("extracts single expression", () => {
    expect(findHandlebarsExpressions("Hello {{name}}")).toEqual(["{{name}}"]);
  });

  it("extracts multiple expressions", () => {
    expect(findHandlebarsExpressions("{{a}} and {{b}}")).toEqual([
      "{{a}}",
      "{{b}}",
    ]);
  });

  it("returns [] for text with no expressions", () => {
    expect(findHandlebarsExpressions("no templates here")).toEqual([]);
  });

  it("handles unclosed {{ (no match)", () => {
    expect(findHandlebarsExpressions("broken {{template")).toEqual([]);
  });

  it("handles adjacent expressions", () => {
    expect(findHandlebarsExpressions("{{a}}{{b}}")).toEqual(["{{a}}", "{{b}}"]);
  });

  it("extracts expressions with dots", () => {
    expect(findHandlebarsExpressions("{{row.name}}")).toEqual(["{{row.name}}"]);
  });
});

describe("getHandlebarsStatus", () => {
  it('returns "none" for plain text', () => {
    expect(getHandlebarsStatus("just text")).toBe("none");
  });

  it('returns "valid" for "{{name}}"', () => {
    expect(getHandlebarsStatus("{{name}}")).toBe("valid");
  });

  it('returns "valid" for "{{row.name}}"', () => {
    expect(getHandlebarsStatus("{{row.name}}")).toBe("valid");
  });

  it('returns "valid" for mixed text and expression', () => {
    expect(getHandlebarsStatus("Hello {{name}}!")).toBe("valid");
  });

  it('returns "invalid" for empty inner: "{{}}"', () => {
    expect(getHandlebarsStatus("{{}}")).toBe("invalid");
  });

  it('returns "invalid" for trailing dot: "{{name.}}"', () => {
    expect(getHandlebarsStatus("{{name.}}")).toBe("invalid");
  });

  it('returns "invalid" for leading dot: "{{.name}}"', () => {
    expect(getHandlebarsStatus("{{.name}}")).toBe("invalid");
  });

  it('returns "invalid" for double dot: "{{a..b}}"', () => {
    expect(getHandlebarsStatus("{{a..b}}")).toBe("invalid");
  });

  it('returns "invalid" for disallowed characters', () => {
    expect(getHandlebarsStatus("{{na$me}}")).toBe("invalid");
  });

  it('returns "valid" for helper with hash arguments', () => {
    expect(
      getHandlebarsStatus("{{formatNumber row.temp decimals=2}}")
    ).toBe("valid");
  });

  it('returns "valid" for helper with quoted string argument', () => {
    expect(
      getHandlebarsStatus('{{formatDate row.created_at format="date"}}')
    ).toBe("valid");
  });

  it('returns "valid" for helper with positional string argument', () => {
    expect(
      getHandlebarsStatus('{{datePart row.created_at "year"}}')
    ).toBe("valid");
  });
});

describe("getFlowbiteColor", () => {
  it('maps "valid" -> "success"', () => {
    expect(getFlowbiteColor("valid")).toBe("success");
  });

  it('maps "invalid" -> "failure"', () => {
    expect(getFlowbiteColor("invalid")).toBe("failure");
  });

  it('maps "none" -> "gray"', () => {
    expect(getFlowbiteColor("none")).toBe("gray");
  });
});

describe("resolveDataProperty", () => {
  it("returns plain key as-is", () => {
    expect(resolveDataProperty("origin")).toBe("origin");
  });

  it('extracts from "{{row.origin}}"', () => {
    expect(resolveDataProperty("{{row.origin}}")).toBe("origin");
  });

  it('extracts from "{{origin}}"', () => {
    expect(resolveDataProperty("{{origin}}")).toBe("origin");
  });

  it("handles spaces inside braces", () => {
    expect(resolveDataProperty("{{ origin }}")).toBe("origin");
  });

  it("returns null for complex template", () => {
    expect(resolveDataProperty("{{a}} - {{b}}")).toBeNull();
  });

  it("returns null for template with text mixed", () => {
    expect(resolveDataProperty("prefix-{{a}}")).toBeNull();
  });
});
