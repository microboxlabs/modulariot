import { describe, expect, it, vi } from "vitest";
import { SlashRegistry } from "../slash/registry.js";
import { clearCommand } from "../slash/handlers/clear.js";
import { exitCommand } from "../slash/handlers/exit.js";
import { helpCommand } from "../slash/handlers/help.js";
import { modeCommand } from "../slash/handlers/mode.js";
import { resetCommand } from "../slash/handlers/reset.js";
import { saveCommand } from "../slash/handlers/save.js";
import { tenantCommand } from "../slash/handlers/tenant.js";
import { initialSession } from "../session/reducer.js";
import type { ReducerContext, SessionState } from "../session/types.js";

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

function mkSession(): SessionState {
  const ctx: ReducerContext = {
    now: () => "2026-01-01T00:00:00Z",
    uuid: () => "conv-id",
  };
  return initialSession(
    {
      tenantId: "demo-tenant",
      userId: "demo-user",
      mode: "auto",
      baseUrl: "http://localhost:8000",
    },
    ctx,
  );
}

describe("/mode", () => {
  it("dispatches SET_MODE for a valid choice", async () => {
    const r = await modeCommand.handle(["agentic"], mkCtx(new SlashRegistry()));
    expect(r).toEqual({ dispatch: { kind: "SET_MODE", mode: "agentic" } });
  });

  it("returns an error for unknown mode", async () => {
    const r = await modeCommand.handle(["wat"], mkCtx(new SlashRegistry()));
    expect(r.error).toContain("unknown mode");
  });

  it("returns usage when called with no args", async () => {
    const r = await modeCommand.handle([], mkCtx(new SlashRegistry()));
    expect(r.error).toContain("usage:");
  });
});

describe("/tenant", () => {
  it("dispatches SET_TENANT", async () => {
    const r = await tenantCommand.handle(["mintral"], mkCtx(new SlashRegistry()));
    expect(r).toEqual({ dispatch: { kind: "SET_TENANT", tenant: "mintral" } });
  });

  it("returns usage when called with no args", async () => {
    const r = await tenantCommand.handle([], mkCtx(new SlashRegistry()));
    expect(r.error).toContain("usage:");
  });
});

describe("/save", () => {
  it("writes the transcript JSON to the given path and emits a system item", async () => {
    const writeFile = vi.fn();
    const session = mkSession();
    const ctx = {
      ...mkCtx(new SlashRegistry()),
      session,
      writeFile,
    };
    const r = await saveCommand.handle(["/tmp/x.json"], ctx);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0]?.[0]).toBe("/tmp/x.json");
    const body = writeFile.mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(body);
    expect(parsed.conversation_id).toBe(session.meta.conversationId);
    expect(parsed.transcript).toEqual([]);
    expect(r.output?.kind).toBe("system");
    if (r.output?.kind === "system") {
      expect(r.output.text).toContain("/tmp/x.json");
    }
  });

  it("returns usage when called with no path", async () => {
    const session = mkSession();
    const ctx = {
      ...mkCtx(new SlashRegistry()),
      session,
      writeFile: vi.fn(),
    };
    const r = await saveCommand.handle([], ctx);
    expect(r.error).toContain("usage:");
  });

  it("surfaces write errors via SlashResult.error", async () => {
    const writeFile = vi.fn(() => {
      throw new Error("EACCES");
    });
    const session = mkSession();
    const ctx = {
      ...mkCtx(new SlashRegistry()),
      session,
      writeFile,
    };
    const r = await saveCommand.handle(["/tmp/x.json"], ctx);
    expect(r.error).toContain("EACCES");
  });

  it("errors when session/now/uuid aren't bound on context", async () => {
    const r = await saveCommand.handle(["/tmp/x.json"], {});
    expect(r.error).toContain("not bound");
  });
});
