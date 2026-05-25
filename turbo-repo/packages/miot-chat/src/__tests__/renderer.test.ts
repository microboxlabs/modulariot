import { describe, expect, it } from "vitest";
import {
  clearStatus,
  initialState,
  renderAuthoritativeAnswer,
  renderEvent,
  renderRunFailure,
  type RenderState,
} from "../repl/renderer.js";
import { stripAnsi } from "../output.js";
import type { HarnessEvent, HarnessEventType } from "@microboxlabs/miot-harness-client";

function evt(
  type: HarnessEventType,
  overrides: Partial<HarnessEvent> = {},
): HarnessEvent {
  return {
    id: overrides.id ?? `evt_${type}`,
    run_id: overrides.run_id ?? "run_test",
    seq: overrides.seq ?? 1,
    type,
    message: overrides.message ?? "",
    data: overrides.data ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  };
}

function feed(state: RenderState, events: HarnessEvent[]) {
  const outputs: string[] = [];
  let s = state;
  for (const e of events) {
    const r = renderEvent(s, e);
    s = r.state;
    outputs.push(r.output);
  }
  return { state: s, outputs };
}

describe("renderEvent — non-terminal status line", () => {
  it("emits a dim status line for run.started", () => {
    const { state, outputs } = feed(initialState(), [evt("run.started")]);
    expect(stripAnsi(outputs[0] ?? "")).toBe("starting…");
    expect(state.hasStatusLine).toBe(true);
  });

  it("clears the previous status line before writing a new one", () => {
    const { outputs } = feed(initialState(), [
      evt("run.started"),
      evt("route.selected", { data: { route: "NEXO_QUERY" } }),
    ]);
    expect(outputs[1]?.startsWith("\r\x1b[K")).toBe(true);
    expect(stripAnsi(outputs[1] ?? "")).toBe("route: NEXO_QUERY");
  });

  it("prefers data.name for tool events, falls back to message", () => {
    const { outputs } = feed(initialState(), [
      evt("tool.started", { data: { name: "stock_lookup" } }),
      evt("tool.started", { message: "fallback_name", data: {} }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe("tool: stock_lookup");
    expect(stripAnsi(outputs[1] ?? "")).toBe("tool: fallback_name");
  });
});

describe("renderEvent — answer.completed caches without printing", () => {
  it("captures the answer text from data.text and emits no output", () => {
    const { state, outputs } = feed(initialState(), [
      evt("answer.completed", { data: { text: "first answer" } }),
    ]);
    expect(outputs[0]).toBe("");
    expect(state.pendingAnswer).toBe("first answer");
    expect(state.hasStatusLine).toBe(false);
  });

  it("dual answer.completed (mode denial → meta fallback) keeps the latest", () => {
    const { state, outputs } = feed(initialState(), [
      evt("answer.completed", { data: { text: "denied" } }),
      evt("answer.completed", { data: { text: "fallback answer" } }),
    ]);
    expect(outputs).toEqual(["", ""]);
    expect(state.pendingAnswer).toBe("fallback answer");
  });
});

describe("renderEvent — terminal events", () => {
  it("run.completed clears the status line and writes no answer text (caller renders it)", () => {
    const { outputs, state } = feed(initialState(), [
      evt("run.started"),
      evt("answer.completed", { data: { text: "the answer" } }),
      evt("run.completed"),
    ]);
    // run.completed's output is just the CLEAR_LINE prefix.
    expect(outputs[2]).toBe("\r\x1b[K");
    expect(state.hasStatusLine).toBe(false);
    expect(state.pendingAnswer).toBe("the answer");
  });

  it("run.completed with no status line up is a no-op", () => {
    const { outputs } = feed(initialState(), [evt("run.completed")]);
    expect(outputs[0]).toBe("");
  });

  it("run.failed only clears the status line — renderRunFailure paints the message", () => {
    const { outputs, state } = feed(initialState(), [
      evt("run.started"),
      evt("run.failed", { message: "denied: mode access" }),
    ]);
    expect(outputs[1]).toBe("\r\x1b[K");
    expect(state.hasStatusLine).toBe(false);

    const final = renderRunFailure(state, "denied: mode access");
    expect(stripAnsi(final.output)).toBe("error: denied: mode access\n");
  });

  it("renderRunFailure falls back to 'run failed' on empty message", () => {
    const r = renderRunFailure(initialState(), "");
    expect(stripAnsi(r.output)).toBe("error: run failed\n");
  });
});

describe("clearStatus / renderAuthoritativeAnswer helpers", () => {
  it("clearStatus is a no-op when no status line is up", () => {
    const r = clearStatus(initialState());
    expect(r.output).toBe("");
  });

  it("renderAuthoritativeAnswer prefers the supplied answer over pendingAnswer", () => {
    const seed = initialState();
    const after = renderEvent(seed, evt("answer.completed", { data: { text: "from-event" } }));
    const final = renderAuthoritativeAnswer(after.state, "from-getRun");
    expect(stripAnsi(final.output)).toBe("from-getRun\n");
    expect(final.state.pendingAnswer).toBe("from-getRun");
  });
});

describe("renderer — NO_COLOR mode", () => {
  it("produces no ANSI codes and emits one newline-terminated line per status event", () => {
    const state = initialState({ noColor: true });
    const r1 = renderEvent(state, evt("run.started"));
    expect(r1.output).toBe("starting…\n");
    expect(r1.state.hasStatusLine).toBe(false);

    const r2 = renderEvent(r1.state, evt("route.selected", { data: { route: "NEXO_QUERY" } }));
    expect(r2.output).toBe("route: NEXO_QUERY\n");
    expect(r2.output.includes("\x1b[")).toBe(false);
  });

  it("renderAuthoritativeAnswer drops ANSI when color is disabled", () => {
    const state = initialState({ noColor: true });
    const r = renderEvent(state, evt("run.started"));
    const final = renderAuthoritativeAnswer(r.state, "hi");
    expect(final.output).toBe("hi\n");
  });
});

describe("renderEvent — rich SSE events (plan: thinking + agents + tools)", () => {
  it("agent.started renders a bold ▶ {name} status line", () => {
    const { outputs } = feed(initialState(), [
      evt("agent.started", {
        data: { agent: "synthesizer", graph: "nexo", turn: 1 },
      }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe("▶ synthesizer");
  });

  it("agent.completed renders ✓ {name} ({ms}ms)", () => {
    const { outputs } = feed(initialState(), [
      evt("agent.completed", {
        data: {
          agent: "filter_expert",
          graph: "nexo",
          duration_ms: 812,
          exit_reason: "ok",
        },
      }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe("✓ filter_expert (812ms)");
  });

  it("enriched tool.started carries input_keys inline", () => {
    const { outputs } = feed(initialState(), [
      evt("tool.started", {
        data: {
          tool: "coordinador_l1_kpi_summary",
          input_keys: ["p_window_hours", "tenant_id"],
        },
      }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe(
      "tool: coordinador_l1_kpi_summary(p_window_hours,tenant_id)",
    );
  });

  it("enriched tool.completed carries result_shape inline", () => {
    const { outputs } = feed(initialState(), [
      evt("tool.completed", {
        data: {
          tool: "coordinador_l1_kpi_summary",
          result_shape: { type: "rows", length: 12 },
        },
      }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe(
      "tool ok: coordinador_l1_kpi_summary → rows[12]",
    );
  });

  it("usage.recorded renders inline tokens", () => {
    const { outputs } = feed(initialState(), [
      evt("usage.recorded", {
        data: {
          agent: "synthesizer",
          model: "claude-sonnet-4-6",
          input_tokens: 4012,
          output_tokens: 189,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
    ]);
    expect(stripAnsi(outputs[0] ?? "")).toBe(
      "usage: synthesizer in=4012 out=189",
    );
  });

  it("thinking.delta accumulates into state and emits dimmed text without CLEAR_LINE", () => {
    const { state, outputs } = feed(initialState({ noColor: true }), [
      evt("thinking.delta", { data: { agent: "synthesizer", delta: "Step 1. ", index: 0 } }),
      evt("thinking.delta", { data: { agent: "synthesizer", delta: "Step 2.", index: 1 } }),
    ]);
    expect(outputs[0]).toBe("Step 1. ");
    expect(outputs[1]).toBe("Step 2.");
    expect(state.pendingThinking).toBe("Step 1. Step 2.");
    expect(state.hasThinkingBlock).toBe(true);
  });

  it("thinking.completed emits a newline and clears hasThinkingBlock", () => {
    const seed = initialState({ noColor: true });
    const afterDelta = renderEvent(seed, evt("thinking.delta", {
      data: { agent: "synthesizer", delta: "thinking…", index: 0 },
    }));
    const afterCompleted = renderEvent(
      afterDelta.state,
      evt("thinking.completed", {
        data: { agent: "synthesizer", tokens: 42, length: 9 },
      }),
    );
    expect(afterCompleted.output).toBe("\n");
    expect(afterCompleted.state.hasThinkingBlock).toBe(false);
  });

  it("renderAuthoritativeAnswer prepends a newline when a thinking block was open", () => {
    const seed = initialState({ noColor: true });
    const afterDelta = renderEvent(seed, evt("thinking.delta", {
      data: { agent: "synthesizer", delta: "thinking…", index: 0 },
    }));
    const final = renderAuthoritativeAnswer(afterDelta.state, "the answer");
    // \n (from hasThinkingBlock) + answer + trailing \n
    expect(final.output).toBe("\nthe answer\n");
    expect(final.state.hasThinkingBlock).toBe(false);
  });
});
