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
    pendingApprovals: [],
    currentRunId: null,
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
