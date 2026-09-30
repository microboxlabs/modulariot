import { describe, expect, it } from "vitest";
import {
  SlashRegistry,
  type SlashCommand,
  type SlashResult,
} from "../slash/registry.js";

function cmd(
  name: string,
  summary: string,
  handle: SlashCommand["handle"] = (): SlashResult => ({}),
): SlashCommand {
  return { name, summary, usage: `/${name}`, handle };
}

describe("SlashRegistry — basic ops", () => {
  it("starts empty", () => {
    const reg = new SlashRegistry();
    expect(reg.all()).toEqual([]);
    expect(reg.has("help")).toBe(false);
    expect(reg.get("help")).toBeUndefined();
  });

  it("registers and retrieves commands", () => {
    const reg = new SlashRegistry();
    reg.register(cmd("help", "Show all commands"));
    expect(reg.has("help")).toBe(true);
    expect(reg.get("help")?.name).toBe("help");
  });

  it("all() returns commands sorted by name", () => {
    const reg = new SlashRegistry()
      .register(cmd("whoami", "Show identity"))
      .register(cmd("clear", "Clear screen"))
      .register(cmd("model", "Change model"));
    expect(reg.all().map((c) => c.name)).toEqual(["clear", "model", "whoami"]);
  });

  it("register is chainable and replaces by name", () => {
    const reg = new SlashRegistry();
    reg
      .register(cmd("model", "first"))
      .register(cmd("model", "second")); // replaces
    expect(reg.get("model")?.summary).toBe("second");
  });
});

describe("SlashRegistry — findMatches / tabCompletion", () => {
  function seed(): SlashRegistry {
    return new SlashRegistry()
      .register(cmd("context", "Show session context"))
      .register(cmd("clear", "Clear the transcript"))
      .register(cmd("model", "Pick a model"))
      .register(cmd("whoami", "Print user identity"))
      .register(cmd("tenant", "Change tenant"));
  }

  it("empty prefix returns all commands", () => {
    const reg = seed();
    expect(reg.findMatches("").length).toBe(5);
  });

  it("name-substring match", () => {
    const reg = seed();
    const names = reg.findMatches("co").map((c) => c.name);
    expect(names).toEqual(["context"]);
  });

  it("matches names before summaries", () => {
    const reg = seed();
    const names = reg.findMatches("mod").map((c) => c.name);
    expect(names[0]).toBe("model");
  });

  it("falls back to summary substring", () => {
    const reg = seed();
    const names = reg.findMatches("transcript").map((c) => c.name);
    expect(names).toEqual(["clear"]);
  });

  it("is case-insensitive", () => {
    const reg = seed();
    expect(reg.findMatches("CON").map((c) => c.name)).toEqual(["context"]);
  });

  it("tabCompletion returns the unique name", () => {
    const reg = seed();
    expect(reg.tabCompletion("con")).toBe("context");
  });

  it("tabCompletion returns null when ambiguous", () => {
    const reg = seed();
    reg.register(cmd("contour", "Adjust contour"));
    // "con" now matches both "context" and "contour".
    expect(reg.tabCompletion("con")).toBeNull();
  });

  it("tabCompletion returns null when nothing matches", () => {
    const reg = seed();
    expect(reg.tabCompletion("xyz")).toBeNull();
  });
});
