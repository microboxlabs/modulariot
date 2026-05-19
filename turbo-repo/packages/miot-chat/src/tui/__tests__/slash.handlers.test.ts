import { describe, expect, it } from "vitest";
import { SlashRegistry } from "../slash/registry.js";
import { clearCommand } from "../slash/handlers/clear.js";
import { exitCommand } from "../slash/handlers/exit.js";
import { helpCommand } from "../slash/handlers/help.js";
import { resetCommand } from "../slash/handlers/reset.js";

function mkCtx(registry: SlashRegistry): Record<string, unknown> {
  let n = 0;
  let i = 0;
  return {
    registry,
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

describe("/clear", () => {
  it("dispatches CLEAR with no other side effects", async () => {
    const r = await clearCommand.handle([], mkCtx(new SlashRegistry()));
    expect(r).toEqual({ dispatch: { kind: "CLEAR" } });
  });
});

describe("/reset", () => {
  it("dispatches RESET_CONVERSATION", async () => {
    const r = await resetCommand.handle([], mkCtx(new SlashRegistry()));
    expect(r).toEqual({ dispatch: { kind: "RESET_CONVERSATION" } });
  });
});

describe("/exit", () => {
  it("returns abort:true", async () => {
    const r = await exitCommand.handle([], mkCtx(new SlashRegistry()));
    expect(r).toEqual({ abort: true });
  });
});

describe("/help", () => {
  function seededRegistry(): SlashRegistry {
    return new SlashRegistry()
      .register(helpCommand)
      .register(clearCommand)
      .register(resetCommand)
      .register(exitCommand);
  }

  it("returns a system transcript item listing every registered command", async () => {
    const reg = seededRegistry();
    const ctx = mkCtx(reg);
    const r = await helpCommand.handle([], ctx);
    expect(r.output).toBeDefined();
    expect(r.output?.kind).toBe("system");
    if (r.output?.kind === "system") {
      const text = r.output.text;
      expect(text.startsWith("available commands:")).toBe(true);
      // Should reference each usage string.
      expect(text).toContain("/help");
      expect(text).toContain("/clear");
      expect(text).toContain("/reset");
      expect(text).toContain("/exit");
    }
  });

  it("errors out when registry isn't bound in the context", async () => {
    const r = await helpCommand.handle([], {});
    expect(r.error).toBeDefined();
    expect(r.output).toBeUndefined();
  });

  it("emits items with the injected uuid + now context", async () => {
    const reg = seededRegistry();
    const ctx = mkCtx(reg);
    const r = await helpCommand.handle([], ctx);
    if (r.output) {
      expect(r.output.id).toBe("id-1");
      expect(r.output.ts).toBe("2026-01-01T00:00:00Z");
    }
  });
});
