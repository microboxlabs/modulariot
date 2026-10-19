import { describe, expect, it } from "vitest";
import { parseSlash } from "../repl/slash.js";

describe("parseSlash — routing", () => {
  it("returns noop when the line is not a slash command", () => {
    expect(parseSlash("hello world")).toEqual({ kind: "noop" });
    expect(parseSlash("")).toEqual({ kind: "noop" });
    expect(parseSlash("   ")).toEqual({ kind: "noop" });
  });

  it("ignores leading/trailing whitespace and casing on the head", () => {
    expect(parseSlash("  /EXIT  ").kind).toBe("exit");
    expect(parseSlash("/Quit").kind).toBe("exit");
  });

  it("rejects unknown slash commands", () => {
    expect(parseSlash("/foo")).toEqual({
      kind: "invalid",
      reason: "unknown command: /foo",
    });
  });

  it("no longer knows /mode", () => {
    expect(parseSlash("/mode agentic")).toEqual({
      kind: "invalid",
      reason: "unknown command: /mode",
    });
  });

  it("rejects an empty slash", () => {
    expect(parseSlash("/")).toEqual({
      kind: "invalid",
      reason: "empty slash command",
    });
  });
});

describe("/model", () => {
  it("lists models when given no argument", () => {
    expect(parseSlash("/model")).toEqual({ kind: "list-models" });
    expect(parseSlash("/model   ")).toEqual({ kind: "list-models" });
  });

  it("sets the named model", () => {
    expect(parseSlash("/model claude-x")).toEqual({
      kind: "set-model",
      model: "claude-x",
    });
  });

  it("`/model default` clears the model", () => {
    expect(parseSlash("/model default")).toEqual({
      kind: "set-model",
      model: null,
    });
  });
});

describe("/tenant", () => {
  it("sets a new tenant", () => {
    expect(parseSlash("/tenant acme")).toEqual({
      kind: "set-tenant",
      tenant: "acme",
    });
  });

  it("requires an argument", () => {
    expect(parseSlash("/tenant")).toEqual({
      kind: "invalid",
      reason: "usage: /tenant <id>",
    });
  });
});

describe("/save", () => {
  it("returns the path argument verbatim (preserving spaces)", () => {
    const r = parseSlash("/save my notes.json");
    expect(r.kind).toBe("save");
    if (r.kind === "save") expect(r.path).toBe("my notes.json");
  });

  it("requires a path argument", () => {
    expect(parseSlash("/save")).toEqual({
      kind: "invalid",
      reason: "usage: /save <file>",
    });
  });
});

describe("/exit and /reset", () => {
  it("/exit returns exit intent", () => {
    expect(parseSlash("/exit")).toEqual({ kind: "exit" });
  });

  it("/reset returns reset intent", () => {
    expect(parseSlash("/reset")).toEqual({ kind: "reset" });
  });
});
