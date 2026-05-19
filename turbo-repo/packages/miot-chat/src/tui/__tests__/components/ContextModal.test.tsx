import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ContextModal } from "../../modals/ContextModal.js";
import { contextCommand } from "../../slash/handlers/context.js";
import { whoamiCommand } from "../../slash/handlers/whoami.js";
import { userCommand } from "../../slash/handlers/user.js";
import { initialSession, reduce } from "../../session/reducer.js";
import type { ReducerContext, SessionState } from "../../session/types.js";

function mkCtx(): ReducerContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function mkSession(): SessionState {
  const ctx = mkCtx();
  return initialSession(
    {
      tenantId: "demo-tenant",
      userId: "demo-user",
      mode: "auto",
      baseUrl: "http://localhost:8000",
      profileName: "staging",
    },
    ctx,
  );
}

describe("<ContextModal />", () => {
  it("displays every meta field plus turn count and approvals count", () => {
    const session = mkSession();
    const { lastFrame } = render(
      <ContextModal
        session={session}
        lastRunId="run-42"
        onClose={() => undefined}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("tenant");
    expect(frame).toContain("demo-tenant");
    expect(frame).toContain("user");
    expect(frame).toContain("demo-user");
    expect(frame).toContain("conv");
    expect(frame).toContain(session.meta.conversationId);
    expect(frame).toContain("mode");
    expect(frame).toContain("auto");
    expect(frame).toContain("http://localhost:8000");
    expect(frame).toContain("profile");
    expect(frame).toContain("staging");
    expect(frame).toContain("turns");
    expect(frame).toContain("last run");
    expect(frame).toContain("run-42");
    expect(frame).toContain("pending approvals");
  });

  it("dismisses on Esc", async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <ContextModal
        session={mkSession()}
        lastRunId={null}
        onClose={onClose}
      />,
    );
    stdin.write("\x1b");
    // Ink's input parser holds the ESC byte briefly to disambiguate it from
    // the lead of a CSI sequence; flush by waiting through a couple of
    // microtask ticks.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Enter", async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <ContextModal
        session={mkSession()}
        lastRunId={null}
        onClose={onClose}
      />,
    );
    stdin.write("\r");
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("/context handler", () => {
  it("returns a modal directive", async () => {
    const r = await contextCommand.handle([], {});
    expect(r.modal).toEqual({ kind: "context" });
  });
});

describe("/whoami handler", () => {
  function ctx(): Record<string, unknown> {
    let n = 0;
    let i = 0;
    return {
      session: mkSession(),
      now: (): string => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
      uuid: (): string => `id-${++i}`,
    };
  }

  it("emits a system transcript item with user/tenant/conv", async () => {
    const r = await whoamiCommand.handle([], ctx());
    expect(r.output?.kind).toBe("system");
    if (r.output?.kind === "system") {
      expect(r.output.text).toContain("user=demo-user");
      expect(r.output.text).toContain("tenant=demo-tenant");
      expect(r.output.text).toContain("conv=");
    }
  });

  it("errors when session/now/uuid aren't bound", async () => {
    const r = await whoamiCommand.handle([], {});
    expect(r.error).toContain("not bound");
  });
});

describe("/user handler", () => {
  it("dispatches SET_USER", async () => {
    const r = await userCommand.handle(["alice"], {});
    expect(r).toEqual({ dispatch: { kind: "SET_USER", user: "alice" } });
  });

  it("returns usage when called with no arg", async () => {
    const r = await userCommand.handle([], {});
    expect(r.error).toContain("usage:");
  });

  it("SET_USER dispatch is honored by the session reducer", () => {
    const ctx = mkCtx();
    const start = mkSession();
    const next = reduce(start, { kind: "SET_USER", user: "bob" }, ctx);
    expect(next.meta.userId).toBe("bob");
    expect(next.meta.tenantId).toBe(start.meta.tenantId);
  });
});
