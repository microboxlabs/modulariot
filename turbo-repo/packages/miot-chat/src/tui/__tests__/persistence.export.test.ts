import { describe, expect, it, vi } from "vitest";
import { toMarkdown } from "../persistence/exportMarkdown.js";
import { exportCommand } from "../slash/handlers/export.js";
import { initialSession, reduce } from "../session/reducer.js";
import type {
  HarnessEvent,
  HarnessEventType,
} from "@microboxlabs/miot-harness-client";
import type { ReducerContext, SessionState } from "../session/types.js";

function mkCtx(): ReducerContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function evt(
  type: HarnessEventType,
  overrides: Partial<HarnessEvent> = {},
): HarnessEvent {
  return {
    id: overrides.id ?? `e_${type}`,
    run_id: overrides.run_id ?? "r1",
    seq: overrides.seq ?? 1,
    type,
    message: overrides.message ?? "",
    data: overrides.data ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
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

describe("toMarkdown — header", () => {
  it("emits an H1 with the short conv id and meta bullets", () => {
    const md = toMarkdown(mkSession());
    expect(md).toContain("# miot-chat session ");
    expect(md).toContain("conversation_id: `id-1`");
    expect(md).toContain("tenant: `demo-tenant`");
    expect(md).toContain("user: `demo-user`");
    expect(md).toContain("mode: `auto`");
    expect(md).toContain("profile: `staging`");
    expect(md).toContain("baseUrl: http://localhost:8000");
  });

  it("emits a (no turns) marker when transcript is empty", () => {
    expect(toMarkdown(mkSession())).toContain("(no turns)");
  });
});

describe("toMarkdown — turns", () => {
  it("groups items into turns at each user prompt", () => {
    const ctx = mkCtx();
    let s = mkSession();
    s = reduce(s, { kind: "BEGIN_TURN", prompt: "first" }, ctx);
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.started", { data: { name: "lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.completed", { data: { name: "lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "result A" } }),
        runId: "r1",
      },
      ctx,
    );
    s = reduce(s, { kind: "END_TURN", record: undefined }, ctx);
    s = reduce(s, { kind: "BEGIN_TURN", prompt: "second" }, ctx);
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "result B" } }),
        runId: "r2",
      },
      ctx,
    );

    const md = toMarkdown(s);
    expect(md).toContain("## Turn 1");
    expect(md).toContain("**you:** first");
    expect(md).toContain("tool lookup ✓");
    expect(md).toContain("**miot:** result A");
    expect(md).toContain("## Turn 2");
    expect(md).toContain("**you:** second");
    expect(md).toContain("**miot (streaming):** result B");
  });

  it("renders failed tools and routes as blockquote lines", () => {
    const ctx = mkCtx();
    let s = mkSession();
    s = reduce(s, { kind: "BEGIN_TURN", prompt: "p" }, ctx);
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("route.selected", { data: { route: "NEXO_QUERY" } }),
        runId: "r1",
      },
      ctx,
    );
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.failed", {
          data: { name: "writer" },
          message: "timeout",
        }),
        runId: "r1",
      },
      ctx,
    );
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("freshness.warning", { message: "20d stale" }),
        runId: "r1",
      },
      ctx,
    );
    const md = toMarkdown(s);
    expect(md).toContain("> route: NEXO_QUERY");
    expect(md).toContain("tool writer ✗ — timeout");
    expect(md).toContain("> ⚠ 20d stale");
  });
});

describe("/export handler", () => {
  function ctx(): Record<string, unknown> {
    let n = 0;
    let i = 0;
    return {
      session: mkSession(),
      now: (): string => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
      uuid: (): string => `id-${++i}`,
      writeFile: vi.fn(),
    };
  }

  it("writes markdown to the given path and returns a system item", async () => {
    const c = ctx();
    const r = await exportCommand.handle(["/tmp/foo.md"], c);
    const writeFile = c.writeFile as ReturnType<typeof vi.fn>;
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile.mock.calls[0]?.[0]).toBe("/tmp/foo.md");
    const body = writeFile.mock.calls[0]?.[1] as string;
    expect(body).toContain("# miot-chat session ");
    expect(r.output?.kind).toBe("system");
  });

  it("returns usage when called with no args", async () => {
    const c = ctx();
    const r = await exportCommand.handle([], c);
    expect(r.error).toContain("usage:");
  });

  it("surfaces write errors via SlashResult.error", async () => {
    const c = {
      ...ctx(),
      writeFile: vi.fn(() => {
        throw new Error("ENOSPC");
      }),
    };
    const r = await exportCommand.handle(["/tmp/x.md"], c);
    expect(r.error).toContain("ENOSPC");
  });

  it("errors when session/now/uuid aren't bound", async () => {
    const r = await exportCommand.handle(["/tmp/x.md"], {});
    expect(r.error).toContain("not bound");
  });
});
