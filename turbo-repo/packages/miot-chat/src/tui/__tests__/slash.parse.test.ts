import { describe, expect, it } from "vitest";
import { parseSlash, validateArgs } from "../slash/parse.js";

describe("parseSlash", () => {
  it("returns null for non-slash input", () => {
    expect(parseSlash("hello")).toBeNull();
    expect(parseSlash("")).toBeNull();
    expect(parseSlash("   ")).toBeNull();
  });

  it("returns null for a bare slash", () => {
    expect(parseSlash("/")).toBeNull();
    expect(parseSlash("  /  ")).toBeNull();
  });

  it("parses a bare command", () => {
    expect(parseSlash("/help")).toEqual({ name: "help", args: [] });
  });

  it("parses positional args", () => {
    expect(parseSlash("/theme dark")).toEqual({
      name: "theme",
      args: ["dark"],
    });
    expect(parseSlash("/save  /tmp/foo.json")).toEqual({
      name: "save",
      args: ["/tmp/foo.json"],
    });
  });

  it("lowercases the command name", () => {
    expect(parseSlash("/HELP")).toEqual({ name: "help", args: [] });
    expect(parseSlash("/Theme Dark")).toEqual({
      name: "theme",
      args: ["Dark"],
    });
  });

  it("collapses multiple spaces between tokens", () => {
    expect(parseSlash("/theme    dark")).toEqual({
      name: "theme",
      args: ["dark"],
    });
  });

  it("trims leading/trailing whitespace before parsing", () => {
    expect(parseSlash("   /help   ")).toEqual({ name: "help", args: [] });
  });
});

describe("validateArgs", () => {
  it("returns ok with empty values for handlers with no schema", () => {
    expect(validateArgs(undefined, [])).toEqual({ ok: true, values: {} });
    expect(validateArgs([], ["unused"])).toEqual({ ok: true, values: {} });
  });

  it("flags a missing required argument", () => {
    const r = validateArgs(
      [{ name: "theme", required: true, choices: ["light", "dark"] }],
      [],
    );
    expect(r).toEqual({ ok: false, error: "missing argument: theme" });
  });

  it("accepts an optional argument that is omitted", () => {
    const r = validateArgs([{ name: "file", required: false }], []);
    expect(r).toEqual({ ok: true, values: { file: undefined } });
  });

  it("flags an unknown choice", () => {
    const r = validateArgs(
      [{ name: "theme", required: true, choices: ["light", "dark"] }],
      ["junk"],
    );
    expect(r).toEqual({ ok: false, error: "unknown theme: junk" });
  });

  it("returns the values map keyed by spec name on success", () => {
    const r = validateArgs(
      [
        { name: "theme", required: true, choices: ["light", "dark"] },
        { name: "extra", required: false },
      ],
      ["dark", "hello"],
    );
    expect(r).toEqual({
      ok: true,
      values: { theme: "dark", extra: "hello" },
    });
  });
});
