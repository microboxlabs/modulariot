import { describe, expect, it } from "vitest";
import type {
  HarnessEvent,
  HarnessEventType,
  HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";
import {
  initialSession,
  reduce,
} from "../session/reducer.js";
import {
  isStreaming,
  latestAssistantText,
  pendingApprovalCount,
  shortConversationId,
} from "../session/selectors.js";
import type {
  PendingApproval,
  ReducerContext,
  SessionState,
  TranscriptItem,
} from "../session/types.js";

function mkCtx(): ReducerContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function mkSession(): { ctx: ReducerContext; state: SessionState } {
  const ctx = mkCtx();
  const state = initialSession(
    {
      tenantId: "demo-tenant",
      userId: "demo-user",
      mode: "auto",
      baseUrl: "http://localhost:8000",
      profileName: null,
    },
    ctx,
  );
  return { ctx, state };
}

function evt(
  type: HarnessEventType,
  overrides: Partial<HarnessEvent> = {},
): HarnessEvent {
  return {
    id: overrides.id ?? `e_${type}`,
    run_id: overrides.run_id ?? "run_test",
    seq: overrides.seq ?? 1,
    type,
    message: overrides.message ?? "",
    data: overrides.data ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  };
}

function transcriptKinds(s: SessionState): TranscriptItem["kind"][] {
  return s.transcript.map((i) => i.kind);
}

describe("session reducer — initialSession", () => {
  it("mints a uuid for the conversation id", () => {
    const { state } = mkSession();
    expect(state.meta.conversationId).toBe("id-1");
    expect(state.transcript).toEqual([]);
    expect(state.pendingApprovals).toEqual([]);
    expect(state.currentRunId).toBeNull();
    expect(state.warnAgenticTenantMismatch).toBe(false);
  });

  it("flags warnAgenticTenantMismatch when starting in agentic on non-mintral", () => {
    const ctx = mkCtx();
    const state = initialSession(
      {
        tenantId: "other",
        userId: "u",
        mode: "agentic",
        baseUrl: "http://x",
      },
      ctx,
    );
    expect(state.warnAgenticTenantMismatch).toBe(true);
  });
});

describe("session reducer — BEGIN_TURN", () => {
  it("appends a user transcript item and records lastSubmittedPrompt", () => {
    const { ctx, state } = mkSession();
    const next = reduce(state, { kind: "BEGIN_TURN", prompt: "hello" }, ctx);
    expect(transcriptKinds(next)).toEqual(["user"]);
    const item = next.transcript[0];
    expect(item).toMatchObject({ kind: "user", text: "hello" });
    expect(next.lastSubmittedPrompt).toBe("hello");
  });
});

describe("session reducer — STREAM_EVENT routing/agent/plan/freshness/artifact", () => {
  it("appends a route item when data.route is set", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("route.selected", { data: { route: "NEXO_QUERY" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript).toHaveLength(1);
    expect(next.transcript[0]).toMatchObject({
      kind: "route",
      route: "NEXO_QUERY",
    });
  });

  it("falls back to event.message for route when data is empty", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("route.selected", { message: "FALLBACK_ROUTE" }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "route",
      route: "FALLBACK_ROUTE",
    });
  });

  it("emits nothing when route.selected has neither data.route nor message", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      { kind: "STREAM_EVENT", event: evt("route.selected"), runId: "r1" },
      ctx,
    );
    expect(next.transcript).toEqual([]);
  });

  it("appends an agent item with data.agent precedence", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("agent.turn", { data: { agent: "planner" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "agent",
      agent: "planner",
    });
  });

  it("plan.created uses event.message and falls back to 'plan ready'", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("plan.created", { message: "drafted 3 steps" }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      { kind: "STREAM_EVENT", event: evt("plan.created"), runId: "r1" },
      ctx,
    );
    expect(b.transcript).toHaveLength(2);
    expect(b.transcript[0]).toMatchObject({
      kind: "plan",
      message: "drafted 3 steps",
    });
    expect(b.transcript[1]).toMatchObject({
      kind: "plan",
      message: "plan ready",
    });
  });

  it("freshness.warning falls back to 'stale data'", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("freshness.warning", { message: "20d old" }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      { kind: "STREAM_EVENT", event: evt("freshness.warning"), runId: "r1" },
      ctx,
    );
    expect(b.transcript[0]).toMatchObject({
      kind: "freshness",
      message: "20d old",
    });
    expect(b.transcript[1]).toMatchObject({
      kind: "freshness",
      message: "stale data",
    });
  });

  it("artifact.created uses data.kind and falls back to 'artifact'", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("artifact.created", { data: { kind: "report" } }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      { kind: "STREAM_EVENT", event: evt("artifact.created"), runId: "r1" },
      ctx,
    );
    expect(b.transcript[0]).toMatchObject({
      kind: "artifact",
      artifactKind: "report",
    });
    expect(b.transcript[1]).toMatchObject({
      kind: "artifact",
      artifactKind: "artifact",
    });
  });
});

describe("session reducer — STREAM_EVENT tool collapse", () => {
  it("tool.started appends a running tool item with data.name precedence", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.started", { data: { name: "stock_lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "tool",
      name: "stock_lookup",
      status: "running",
    });
  });

  it("tool.started falls back to event.message", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.started", { message: "fallback_tool" }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "tool",
      name: "fallback_tool",
    });
  });

  it("tool.completed flips the matching running tool to ok in place", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.started", { data: { name: "stock_lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.completed", { data: { name: "stock_lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(b.transcript).toHaveLength(1);
    expect(b.transcript[0]).toMatchObject({
      kind: "tool",
      name: "stock_lookup",
      status: "ok",
    });
  });

  it("tool.failed flips the matching running tool to failed", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.started", { data: { name: "lookup" } }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.failed", {
          data: { name: "lookup" },
          message: "timeout",
        }),
        runId: "r1",
      },
      ctx,
    );
    expect(b.transcript).toHaveLength(1);
    expect(b.transcript[0]).toMatchObject({
      kind: "tool",
      status: "failed",
      message: "timeout",
    });
  });

  it("tool.completed without a matching running tool appends a new ok item", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("tool.completed", { data: { name: "ghost" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "tool",
      name: "ghost",
      status: "ok",
    });
  });
});

describe("session reducer — STREAM_EVENT answer.completed", () => {
  it("captures data.text and upserts a streaming assistant item", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "first answer" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.currentAssistantItemId).not.toBeNull();
    const item = next.transcript[0];
    expect(item).toMatchObject({
      kind: "assistant",
      text: "first answer",
      runId: "r1",
      status: "streaming",
    });
  });

  it("dual answer.completed (denied → fallback) keeps the latest text", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "denied" } }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "fallback" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(b.transcript).toHaveLength(1);
    expect(b.transcript[0]).toMatchObject({
      kind: "assistant",
      text: "fallback",
    });
  });

  it("answer.completed falls back to data.answer then message", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { answer: "from-answer" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(a.transcript[0]).toMatchObject({
      kind: "assistant",
      text: "from-answer",
    });

    const b = reduce(
      a,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { message: "from-message" }),
        runId: "r1",
      },
      ctx,
    );
    expect(b.transcript[0]).toMatchObject({ text: "from-message" });
  });
});

describe("session reducer — END_TURN", () => {
  it("flips the in-flight assistant item to complete using record.answer", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "draft" } }),
        runId: "r1",
      },
      ctx,
    );
    const record: HarnessRunRecord = {
      run_id: "r1",
      status: "completed",
      events: [],
      artifacts: [],
      answer: "authoritative",
      conversation_id: state.meta.conversationId,
    };
    const b = reduce(a, { kind: "END_TURN", record }, ctx);
    expect(b.currentRunId).toBeNull();
    expect(b.currentAssistantItemId).toBeNull();
    expect(b.transcript[0]).toMatchObject({
      kind: "assistant",
      status: "complete",
      text: "authoritative",
    });
  });

  it("keeps the streamed text when record.answer is null", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "streamed" } }),
        runId: "r1",
      },
      ctx,
    );
    const record: HarnessRunRecord = {
      run_id: "r1",
      status: "completed",
      events: [],
      artifacts: [],
      answer: null,
      conversation_id: state.meta.conversationId,
    };
    const b = reduce(a, { kind: "END_TURN", record }, ctx);
    expect(b.transcript[0]).toMatchObject({
      kind: "assistant",
      status: "complete",
      text: "streamed",
    });
  });

  it("appends a system error item and flips assistant to failed on failureMessage", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "draft" } }),
        runId: "r1",
      },
      ctx,
    );
    const b = reduce(
      a,
      { kind: "END_TURN", failureMessage: "denied: mode access" },
      ctx,
    );
    expect(b.transcript[0]).toMatchObject({
      kind: "assistant",
      status: "failed",
    });
    expect(b.transcript[1]).toMatchObject({
      kind: "system",
      text: "error: denied: mode access",
    });
  });

  it("END_TURN with no record and no failure inserts a placeholder system item", () => {
    const { ctx, state } = mkSession();
    const next = reduce(state, { kind: "END_TURN" }, ctx);
    expect(next.transcript[0]).toMatchObject({
      kind: "system",
      text: "(no answer recorded)",
    });
  });
});

describe("session reducer — SET_MODE / SET_TENANT / SET_USER", () => {
  it("SET_MODE to agentic on a non-mintral tenant raises the warning flag", () => {
    const { ctx, state } = mkSession();
    const next = reduce(state, { kind: "SET_MODE", mode: "agentic" }, ctx);
    expect(next.meta.mode).toBe("agentic");
    expect(next.warnAgenticTenantMismatch).toBe(true);
  });

  it("SET_TENANT to mintral clears the warning when mode is agentic", () => {
    const { ctx, state } = mkSession();
    const a = reduce(state, { kind: "SET_MODE", mode: "agentic" }, ctx);
    expect(a.warnAgenticTenantMismatch).toBe(true);
    const b = reduce(a, { kind: "SET_TENANT", tenant: "mintral" }, ctx);
    expect(b.warnAgenticTenantMismatch).toBe(false);
    expect(b.meta.tenantId).toBe("mintral");
  });

  it("SET_USER updates only userId", () => {
    const { ctx, state } = mkSession();
    const next = reduce(state, { kind: "SET_USER", user: "alice" }, ctx);
    expect(next.meta.userId).toBe("alice");
    expect(next.meta.tenantId).toBe(state.meta.tenantId);
  });
});

describe("session reducer — RESET_CONVERSATION / CLEAR / LOAD_SESSION", () => {
  it("RESET_CONVERSATION mints a new conv id and clears transcript", () => {
    const { ctx, state } = mkSession();
    const seeded = reduce(
      state,
      { kind: "BEGIN_TURN", prompt: "hi" },
      ctx,
    );
    expect(seeded.transcript).toHaveLength(1);
    const reset = reduce(seeded, { kind: "RESET_CONVERSATION" }, ctx);
    expect(reset.meta.conversationId).not.toBe(state.meta.conversationId);
    expect(reset.transcript).toEqual([]);
    expect(reset.currentRunId).toBeNull();
  });

  it("CLEAR drops the transcript but keeps the conv id", () => {
    const { ctx, state } = mkSession();
    const seeded = reduce(state, { kind: "BEGIN_TURN", prompt: "x" }, ctx);
    const cleared = reduce(seeded, { kind: "CLEAR" }, ctx);
    expect(cleared.meta.conversationId).toBe(state.meta.conversationId);
    expect(cleared.transcript).toEqual([]);
  });

  it("LOAD_SESSION replaces the entire state with the provided one", () => {
    const { ctx, state } = mkSession();
    const loaded: SessionState = {
      ...state,
      lastSubmittedPrompt: "earlier",
      transcript: [
        {
          kind: "user",
          id: "u-old",
          text: "earlier",
          ts: "2025-01-01T00:00:00Z",
        },
      ],
    };
    const next = reduce(state, { kind: "LOAD_SESSION", state: loaded }, ctx);
    expect(next).toEqual(loaded);
  });
});

describe("session reducer — approvals", () => {
  it("STREAM_EVENT approval.requested appends a system item AND records pending approval", () => {
    const { ctx, state } = mkSession();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("approval.requested", {
          id: "appr-1",
          message: "approve risky tool?",
          data: { reason: "writes" },
        }),
        runId: "r1",
      },
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "system",
      text: "approval requested: approve risky tool?",
    });
    expect(next.pendingApprovals).toHaveLength(1);
    expect(next.pendingApprovals[0]).toMatchObject({
      id: "appr-1",
      runId: "r1",
      message: "approve risky tool?",
    });
  });

  it("RECORD_APPROVAL adds to pendingApprovals", () => {
    const { ctx, state } = mkSession();
    const approval: Omit<PendingApproval, "ts"> = {
      id: "a-1",
      runId: "r1",
      message: "hi",
      data: {},
    };
    const next = reduce(
      state,
      { kind: "RECORD_APPROVAL", approval },
      ctx,
    );
    expect(next.pendingApprovals[0]).toMatchObject({ id: "a-1", message: "hi" });
  });

  it("RESOLVE_APPROVAL moves an entry from pending to resolved", () => {
    const { ctx, state } = mkSession();
    const a = reduce(
      state,
      {
        kind: "RECORD_APPROVAL",
        approval: { id: "a-1", runId: "r1", message: "", data: {} },
      },
      ctx,
    );
    const b = reduce(
      a,
      { kind: "RESOLVE_APPROVAL", id: "a-1", decision: "approve" },
      ctx,
    );
    expect(b.pendingApprovals).toEqual([]);
    expect(b.resolvedApprovals[0]).toMatchObject({
      id: "a-1",
      decision: "approve",
    });
  });
});

describe("session selectors", () => {
  it("isStreaming reflects currentRunId presence", () => {
    const { ctx, state } = mkSession();
    expect(isStreaming(state)).toBe(false);
    const a = reduce(state, { kind: "BEGIN_TURN", prompt: "p" }, ctx);
    const b = reduce(
      a,
      {
        kind: "STREAM_EVENT",
        event: evt("run.started"),
        runId: "r1",
      },
      ctx,
    );
    expect(isStreaming(b)).toBe(true);
  });

  it("shortConversationId returns the first 8 chars", () => {
    const { state } = mkSession();
    const s = shortConversationId({
      ...state,
      meta: {
        ...state.meta,
        conversationId: "abcdef0123456789",
      },
    });
    expect(s).toBe("abcdef01");
  });

  it("pendingApprovalCount mirrors the array length", () => {
    const { ctx, state } = mkSession();
    expect(pendingApprovalCount(state)).toBe(0);
    const next = reduce(
      state,
      {
        kind: "RECORD_APPROVAL",
        approval: { id: "a1", runId: "r", message: "", data: {} },
      },
      ctx,
    );
    expect(pendingApprovalCount(next)).toBe(1);
  });

  it("latestAssistantText returns the most recent assistant item's text or null", () => {
    const { ctx, state } = mkSession();
    expect(latestAssistantText(state)).toBeNull();
    const next = reduce(
      state,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "hi" } }),
        runId: "r1",
      },
      ctx,
    );
    expect(latestAssistantText(next)).toBe("hi");
  });
});
