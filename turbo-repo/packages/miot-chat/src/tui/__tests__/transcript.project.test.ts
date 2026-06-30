import { describe, expect, it } from "vitest";
import type {
  HarnessEvent,
  HarnessEventType,
} from "@microboxlabs/miot-harness-client";
import {
  applyHarnessEvent,
  type ProjectionContext,
  type TranscriptSlice,
} from "../transcript/project.js";

function mkCtx(): ProjectionContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function emptySlice(): TranscriptSlice {
  return {
    transcript: [],
    currentAssistantItemId: null,
    currentThinkingItemId: null,
    pendingApprovals: [],
    currentRunId: null,
    usageTotals: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0,
      lastAgent: null,
      lastCostUsd: null,
    },
  };
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

describe("transcript projector — meta events", () => {
  it("run.started sets currentRunId without mutating transcript", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(emptySlice(), evt("run.started"), "r1", ctx);
    expect(next.currentRunId).toBe("r1");
    expect(next.transcript).toEqual([]);
  });

  it("approval.auto and steering.mode_denied are no-op status markers", () => {
    const ctx = mkCtx();
    const seeded: TranscriptSlice = { ...emptySlice(), currentRunId: "r1" };
    for (const type of ["approval.auto", "steering.mode_denied"] as const) {
      const next = applyHarnessEvent(seeded, evt(type), "r1", ctx);
      expect(next).toEqual(seeded);
    }
  });

  it("run.completed and run.failed are no-ops on the slice", () => {
    const ctx = mkCtx();
    const seeded: TranscriptSlice = {
      ...emptySlice(),
      currentRunId: "r1",
      transcript: [
        {
          kind: "assistant",
          id: "a-1",
          runId: "r1",
          text: "x",
          status: "streaming",
          ts: "t",
        },
      ],
      currentAssistantItemId: "a-1",
    };
    const a = applyHarnessEvent(seeded, evt("run.completed"), "r1", ctx);
    const b = applyHarnessEvent(seeded, evt("run.failed"), "r1", ctx);
    expect(a).toEqual(seeded);
    expect(b).toEqual(seeded);
  });
});

describe("transcript projector — tool collapse", () => {
  it("tool.started then tool.completed collapses to one ok item", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("tool.started", { data: { name: "lookup" } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("tool.completed", { data: { name: "lookup" } }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({
      kind: "tool",
      name: "lookup",
      status: "ok",
    });
  });

  it("tool.failed flips a running tool to failed and records message", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("tool.started", { data: { name: "x" } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("tool.failed", { data: { name: "x" }, message: "boom" }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({
      kind: "tool",
      status: "failed",
      message: "boom",
    });
  });

  it("tool.completed without a matching running tool appends a new ok item", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("tool.completed", { data: { name: "ghost" } }),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "tool",
      name: "ghost",
      status: "ok",
    });
  });
});

describe("transcript projector — answer.completed precedence", () => {
  it("upserts a streaming assistant item with data.text", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("answer.completed", { data: { text: "hi" } }),
      "r1",
      ctx,
    );
    expect(next.currentAssistantItemId).not.toBeNull();
    expect(next.transcript[0]).toMatchObject({
      kind: "assistant",
      text: "hi",
      status: "streaming",
      runId: "r1",
    });
  });

  it("dual answer.completed keeps the latest text (meta fallback)", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("answer.completed", { data: { text: "denied" } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("answer.completed", { data: { text: "fallback" } }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({ text: "fallback" });
  });

  it("creates a streaming placeholder when answer.completed has only event.message (no data.text/answer)", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("answer.completed", { message: "Synthesized final answer" }),
      "r1",
      ctx,
    );
    // Should NOT use event.message as the assistant body — it's a
    // status marker. Keep the placeholder empty until END_TURN fills
    // it from the run record.
    expect(next.currentAssistantItemId).not.toBeNull();
    expect(next.transcript[0]).toMatchObject({
      kind: "assistant",
      text: "",
      status: "streaming",
    });
  });

  it("answer.completed with empty body does not clobber an existing text", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("answer.completed", { data: { text: "partial" } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("answer.completed", { message: "status marker" }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({ text: "partial" });
  });

  it("falls back to data.answer when data.text is missing", () => {
    const ctx = mkCtx();
    const s = applyHarnessEvent(
      emptySlice(),
      evt("answer.completed", { data: { answer: "from-answer" } }),
      "r1",
      ctx,
    );
    expect(s.transcript[0]).toMatchObject({ text: "from-answer" });
  });
});

describe("transcript projector — answer.delta streaming", () => {
  it("accumulates answer.delta into one streaming assistant item", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("answer.delta", { data: { delta: "Hola " } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("answer.delta", { data: { delta: "mundo" } }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({
      kind: "assistant",
      text: "Hola mundo",
      status: "streaming",
    });
    expect(s.currentAssistantItemId).not.toBeNull();
  });

  it("ignores answer.delta with an empty delta", () => {
    const ctx = mkCtx();
    const s = applyHarnessEvent(
      emptySlice(),
      evt("answer.delta", { data: { delta: "" } }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(0);
    expect(s.currentAssistantItemId).toBeNull();
  });
});

describe("transcript projector — tool name normalization", () => {
  it("strips 'Starting <name>' / 'Completed <name>' so paired events collapse", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("tool.started", {
        data: { name: "Starting coordinador_eta_riesgo_hoy" },
      }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("tool.completed", {
        data: { name: "Completed coordinador_eta_riesgo_hoy" },
      }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({
      kind: "tool",
      name: "coordinador_eta_riesgo_hoy",
      status: "ok",
    });
  });

  it("normalizes Failed prefix the same way", () => {
    const ctx = mkCtx();
    let s = applyHarnessEvent(
      emptySlice(),
      evt("tool.started", { data: { name: "Running x" } }),
      "r1",
      ctx,
    );
    s = applyHarnessEvent(
      s,
      evt("tool.failed", {
        data: { name: "Failed x" },
        message: "boom",
      }),
      "r1",
      ctx,
    );
    expect(s.transcript).toHaveLength(1);
    expect(s.transcript[0]).toMatchObject({
      kind: "tool",
      name: "x",
      status: "failed",
      message: "boom",
    });
  });
});

describe("transcript projector — labels with message fallback", () => {
  it("route.selected emits nothing when neither data.route nor message is present", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("route.selected"),
      "r1",
      ctx,
    );
    expect(next).toEqual(emptySlice());
  });

  it("agent.turn falls back to event.message", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("agent.turn", { message: "planner-fallback" }),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "agent",
      agent: "planner-fallback",
    });
  });

  it("plan.created falls back to 'plan ready'", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("plan.created"),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "plan",
      message: "plan ready",
    });
  });

  it("freshness.warning falls back to 'stale data'", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("freshness.warning"),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "freshness",
      message: "stale data",
    });
  });

  it("artifact.created falls back to 'artifact' when data.kind missing", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("artifact.created"),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "artifact",
      artifactKind: "artifact",
    });
  });
});

describe("transcript projector — approvals", () => {
  it("approval.requested adds both a system item and a pending approval", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("approval.requested", {
        id: "appr-1",
        message: "writes db",
        data: { reason: "x" },
      }),
      "r1",
      ctx,
    );
    expect(next.transcript[0]).toMatchObject({
      kind: "system",
      text: "approval requested: writes db",
    });
    expect(next.pendingApprovals).toHaveLength(1);
    expect(next.pendingApprovals[0]).toMatchObject({
      id: "appr-1",
      runId: "r1",
      message: "writes db",
    });
  });
});

describe("transcript projector — thinking + usage (plan: SSE rich events)", () => {
  it("thinking.delta creates a streaming thinking item; subsequent deltas append", () => {
    const ctx = mkCtx();
    const s1 = applyHarnessEvent(
      emptySlice(),
      evt("thinking.delta", { data: { agent: "synthesizer", delta: "Step 1. " } }),
      "r1",
      ctx,
    );
    expect(s1.transcript).toHaveLength(1);
    expect(s1.transcript[0]).toMatchObject({
      kind: "thinking",
      agent: "synthesizer",
      text: "Step 1. ",
      status: "streaming",
    });
    const id = s1.currentThinkingItemId!;
    expect(typeof id).toBe("string");

    const s2 = applyHarnessEvent(
      s1,
      evt("thinking.delta", { data: { agent: "synthesizer", delta: "Step 2." } }),
      "r1",
      ctx,
    );
    expect(s2.transcript).toHaveLength(1);
    expect(s2.transcript[0]).toMatchObject({
      kind: "thinking",
      text: "Step 1. Step 2.",
    });
    expect(s2.currentThinkingItemId).toBe(id);
  });

  it("thinking.completed flips status to complete and clears the current id", () => {
    const ctx = mkCtx();
    const s1 = applyHarnessEvent(
      emptySlice(),
      evt("thinking.delta", { data: { agent: "synthesizer", delta: "hi" } }),
      "r1",
      ctx,
    );
    const s2 = applyHarnessEvent(s1, evt("thinking.completed"), "r1", ctx);
    expect(s2.currentThinkingItemId).toBeNull();
    expect(s2.transcript[0]).toMatchObject({ kind: "thinking", status: "complete" });
  });

  it("usage.recorded accumulates totals across calls", () => {
    const ctx = mkCtx();
    const s1 = applyHarnessEvent(
      emptySlice(),
      evt("usage.recorded", {
        data: {
          agent: "filter_expert",
          model: "claude-haiku-4-5",
          input_tokens: 1000,
          output_tokens: 100,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 25,
          cost_usd: 0.0042,
        },
      }),
      "r1",
      ctx,
    );
    expect(s1.usageTotals).toEqual({
      inputTokens: 1000,
      outputTokens: 100,
      cacheReadTokens: 50,
      cacheCreationTokens: 25,
      costUsd: 0.0042,
      lastAgent: "filter_expert",
      lastCostUsd: 0.0042,
    });

    const s2 = applyHarnessEvent(
      s1,
      evt("usage.recorded", {
        data: {
          agent: "synthesizer",
          model: "claude-sonnet-4-6",
          input_tokens: 2000,
          output_tokens: 200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
      "r1",
      ctx,
    );
    expect(s2.usageTotals.inputTokens).toBe(3000);
    expect(s2.usageTotals.outputTokens).toBe(300);
    expect(s2.usageTotals.lastAgent).toBe("synthesizer");
    expect(s2.usageTotals.lastCostUsd).toBeNull();
    expect(s2.usageTotals.costUsd).toBeCloseTo(0.0042);
  });

  it("agent.completed is intentionally dropped from the transcript", () => {
    const ctx = mkCtx();
    const next = applyHarnessEvent(
      emptySlice(),
      evt("agent.completed", { data: { agent: "filter_expert", duration_ms: 100 } }),
      "r1",
      ctx,
    );
    expect(next.transcript).toHaveLength(0);
  });
});
