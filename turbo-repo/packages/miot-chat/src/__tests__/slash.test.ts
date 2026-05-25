import { describe, expect, it } from "vitest";
import {
  AGENTIC_TENANT_LOCK,
  parseSlash,
  type SlashState,
} from "../repl/slash.js";

const seed: SlashState = { mode: "auto", tenant: "demo-tenant" };

describe("parseSlash — routing", () => {
  it("returns noop when the line is not a slash command", () => {
    expect(parseSlash("hello world", seed)).toEqual({ kind: "noop" });
    expect(parseSlash("", seed)).toEqual({ kind: "noop" });
    expect(parseSlash("   ", seed)).toEqual({ kind: "noop" });
  });

  it("ignores leading/trailing whitespace and casing on the head", () => {
    expect(parseSlash("  /EXIT  ", seed).kind).toBe("exit");
    expect(parseSlash("/Quit", seed).kind).toBe("exit");
  });

  it("rejects unknown slash commands", () => {
    expect(parseSlash("/foo", seed)).toEqual({
      kind: "invalid",
      reason: "unknown command: /foo",
    });
  });

  it("rejects an empty slash", () => {
    expect(parseSlash("/", seed)).toEqual({
      kind: "invalid",
      reason: "empty slash command",
    });
  });
});

describe("/mode", () => {
  it.each(["auto", "canned", "meta", "agentic"])("accepts %s", (m) => {
    const r = parseSlash(`/mode ${m}`, seed);
    expect(r.kind).toBe("set-mode");
    if (r.kind === "set-mode") expect(r.mode).toBe(m);
  });

  it("rejects an unknown mode value", () => {
    expect(parseSlash("/mode loud", seed)).toEqual({
      kind: "invalid",
      reason: "unknown mode: loud",
    });
  });

  it("warns when switching to agentic on a non-mintral tenant", () => {
    const r = parseSlash("/mode agentic", seed);
    expect(r.kind).toBe("set-mode");
    if (r.kind === "set-mode") expect(r.warnAgenticTenantMismatch).toBe(true);
  });

  it("does not warn when switching to agentic on the mintral tenant", () => {
    const r = parseSlash("/mode agentic", {
      mode: "auto",
      tenant: AGENTIC_TENANT_LOCK,
    });
    expect(r.kind).toBe("set-mode");
    if (r.kind === "set-mode") expect(r.warnAgenticTenantMismatch).toBe(false);
  });

  it("requires an argument", () => {
    expect(parseSlash("/mode", seed)).toEqual({
      kind: "invalid",
      reason: "usage: /mode <auto|canned|meta|agentic>",
    });
  });
});

describe("/tenant", () => {
  it("sets a new tenant", () => {
    const r = parseSlash("/tenant mintral", seed);
    expect(r.kind).toBe("set-tenant");
    if (r.kind === "set-tenant") expect(r.tenant).toBe("mintral");
  });

  it("warns when changing tenant away from mintral while mode is agentic", () => {
    const r = parseSlash("/tenant some-other", {
      mode: "agentic",
      tenant: AGENTIC_TENANT_LOCK,
    });
    expect(r.kind).toBe("set-tenant");
    if (r.kind === "set-tenant") expect(r.warnAgenticTenantMismatch).toBe(true);
  });

  it("does not warn when mode is not agentic", () => {
    const r = parseSlash("/tenant whatever", seed);
    expect(r.kind).toBe("set-tenant");
    if (r.kind === "set-tenant") expect(r.warnAgenticTenantMismatch).toBe(false);
  });

  it("requires an argument", () => {
    expect(parseSlash("/tenant", seed)).toEqual({
      kind: "invalid",
      reason: "usage: /tenant <id>",
    });
  });
});

describe("/save", () => {
  it("returns the path argument verbatim (preserving spaces)", () => {
    const r = parseSlash("/save my notes.json", seed);
    expect(r.kind).toBe("save");
    if (r.kind === "save") expect(r.path).toBe("my notes.json");
  });

  it("requires a path argument", () => {
    expect(parseSlash("/save", seed)).toEqual({
      kind: "invalid",
      reason: "usage: /save <file>",
    });
  });
});

describe("/exit and /reset", () => {
  it("/exit returns exit intent", () => {
    expect(parseSlash("/exit", seed)).toEqual({ kind: "exit" });
  });

  it("/reset returns reset intent", () => {
    expect(parseSlash("/reset", seed)).toEqual({ kind: "reset" });
  });
});
