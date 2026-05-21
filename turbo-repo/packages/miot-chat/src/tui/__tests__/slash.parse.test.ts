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
    expect(parseSlash("/mode agentic")).toEqual({
      name: "mode",
      args: ["agentic"],
    });
    expect(parseSlash("/save  /tmp/foo.json")).toEqual({
      name: "save",
      args: ["/tmp/foo.json"],
    });
  });

  it("lowercases the command name", () => {
    expect(parseSlash("/HELP")).toEqual({ name: "help", args: [] });
    expect(parseSlash("/Mode Agentic")).toEqual({
      name: "mode",
      args: ["Agentic"],
    });
  });

  it("collapses multiple spaces between tokens", () => {
    expect(parseSlash("/mode    agentic")).toEqual({
      name: "mode",
      args: ["agentic"],
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
      [{ name: "mode", required: true, choices: ["auto", "agentic"] }],
      [],
    );
    expect(r).toEqual({ ok: false, error: "missing argument: mode" });
  });

  it("accepts an optional argument that is omitted", () => {
    const r = validateArgs([{ name: "file", required: false }], []);
    expect(r).toEqual({ ok: true, values: { file: undefined } });
  });

  it("flags an unknown choice", () => {
    const r = validateArgs(
      [{ name: "mode", required: true, choices: ["auto", "agentic"] }],
      ["junk"],
    );
    expect(r).toEqual({ ok: false, error: "unknown mode: junk" });
  });

  it("returns the values map keyed by spec name on success", () => {
    const r = validateArgs(
      [
        { name: "mode", required: true, choices: ["auto", "agentic"] },
        { name: "extra", required: false },
      ],
      ["agentic", "hello"],
    );
    expect(r).toEqual({
      ok: true,
      values: { mode: "agentic", extra: "hello" },
    });
  });
});
