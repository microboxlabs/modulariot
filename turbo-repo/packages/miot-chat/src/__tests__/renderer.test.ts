import { describe, expect, it } from "vitest";
import {
  clearStatus,
  initialState,
  renderAuthoritativeAnswer,
  renderEvent,
  type RenderState,
} from "../repl/renderer.js";
import { stripAnsi } from "../output.js";
import type { HarnessEvent, HarnessEventType } from "../harness/types.js";

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
  it("run.completed prints the cached answer in bold and clears status", () => {
    const { outputs } = feed(initialState(), [
      evt("run.started"),
      evt("answer.completed", { data: { text: "the answer" } }),
      evt("run.completed"),
    ]);
    expect(outputs[2]?.startsWith("\r\x1b[K")).toBe(true);
    expect(stripAnsi(outputs[2] ?? "")).toBe("the answer\n");
  });

  it("run.completed without answer.completed prints a placeholder", () => {
    const { outputs } = feed(initialState(), [evt("run.completed")]);
    expect(stripAnsi(outputs[0] ?? "")).toBe("(no answer recorded)\n");
  });

  it("run.failed prints a red dim error and clears the status line", () => {
    const { outputs } = feed(initialState(), [
      evt("run.started"),
      evt("run.failed", { message: "denied: mode access" }),
    ]);
    expect(outputs[1]?.startsWith("\r\x1b[K")).toBe(true);
    expect(stripAnsi(outputs[1] ?? "")).toBe("error: denied: mode access\n");
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
  it("produces no ANSI codes when color is disabled", () => {
    const state = initialState({ noColor: true });
    const r = renderEvent(state, evt("run.started"));
    expect(r.output).toBe("starting…");
    expect(r.output.includes("\x1b[")).toBe(false);
  });
});
