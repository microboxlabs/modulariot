/**
 * Event→UI-state mapping for the streaming harness search (R1 acceptance:
 * route.selected → phase, tool.started/completed → step states,
 * thinking.delta accumulation, search.result → final results,
 * run.failed/search.error → error state).
 */
import { describe, it, expect } from "vitest";
import {
  INITIAL_PROGRESS,
  reduceHarnessStreamEvent,
  startProgress,
  toolLabelKey,
  type HarnessStreamFrame,
  type HarnessStreamProgress,
} from "./harness-stream";

/** Every frame carries the event's flat data payload (route projects the
 * harness envelope down to `.data` before forwarding). */
function harnessFrame(event: string, data: Record<string, unknown>): HarnessStreamFrame {
  return { event, data };
}

function reduceAll(frames: HarnessStreamFrame[]): HarnessStreamProgress {
  return frames.reduce(reduceHarnessStreamEvent, startProgress());
}

describe("reduceHarnessStreamEvent", () => {
  it("starts in connecting the instant the query is committed", () => {
    expect(startProgress().phase).toBe("connecting");
  });

  it("route.selected sets the routing phase and captures the route", () => {
    const s = reduceAll([harnessFrame("route.selected", { route: "data_agentic" })]);
    expect(s.phase).toBe("routing");
    expect(s.route).toBe("data_agentic");
  });

  it("tool.started appends a running step; tool.completed marks it done", () => {
    const s = reduceAll([
      harnessFrame("tool.started", { tool: "acs_knowledge" }),
      harnessFrame("tool.started", { tool: "acs_query" }),
      harnessFrame("tool.completed", { tool: "acs_knowledge" }),
    ]);
    expect(s.phase).toBe("exploring");
    expect(s.steps).toEqual([
      { tool: "acs_knowledge", status: "done" },
      { tool: "acs_query", status: "running" },
    ]);
  });

  it("repeated tools complete the oldest running instance first", () => {
    const s = reduceAll([
      harnessFrame("tool.started", { tool: "acs_query" }),
      harnessFrame("tool.started", { tool: "acs_query" }),
      harnessFrame("tool.completed", { tool: "acs_query" }),
    ]);
    expect(s.steps.map((x) => x.status)).toEqual(["done", "running"]);
  });

  it("thinking.delta accumulates text and enters the answering phase", () => {
    const s = reduceAll([
      harnessFrame("thinking.delta", { delta: "The evidence" }),
      harnessFrame("thinking.delta", { delta: " is clear." }),
    ]);
    expect(s.phase).toBe("answering");
    expect(s.thinking).toBe("The evidence is clear.");
  });

  it("verification.completed surfaces the verifying phase", () => {
    const s = reduceAll([harnessFrame("verification.completed", {})]);
    expect(s.phase).toBe("verifying");
  });

  it("search.result lands the final results and finishes", () => {
    const results = [{ id: "harness:r1", label: "Servicio", blocks: [] }];
    const s = reduceAll([
      harnessFrame("tool.started", { tool: "acs_query" }),
      { event: "search.result", data: { results } },
    ]);
    expect(s.phase).toBe("done");
    expect(s.results).toEqual(results);
  });

  it("search.accepted captures the run id (candidate provenance)", () => {
    const s = reduceAll([harnessFrame("search.accepted", { run_id: "run_9" })]);
    expect(s.runId).toBe("run_9");
  });

  it("search.result keeps only ungrounded assumptions that carry a connection", () => {
    const assumptions = [
      { term: "entregas", interpretation: "confirmDelivery", predicate: "p", grounded: false, connection: "acs" },
      { term: "grounded", interpretation: "x", predicate: "p", grounded: true, connection: "acs" },
      { term: "no-conn", interpretation: "y", predicate: "p", grounded: false },
    ];
    const s = reduceAll([{ event: "search.result", data: { results: [], assumptions } }]);
    expect(s.phase).toBe("done");
    expect(s.assumptions).toEqual([
      { term: "entregas", interpretation: "confirmDelivery", predicate: "p", grounded: false, connection: "acs" },
    ]);
  });

  it("run.failed and search.error map to the error phase", () => {
    expect(reduceAll([harnessFrame("run.failed", {})]).phase).toBe("error");
    expect(
      reduceAll([{ event: "search.error", data: { error: "stream_failed" } }]).phase,
    ).toBe("error");
  });

  it("unknown events leave the state untouched", () => {
    const s = startProgress();
    expect(reduceHarnessStreamEvent(s, { event: "usage.recorded", data: {} })).toBe(s);
    expect(INITIAL_PROGRESS.phase).toBe("idle");
  });
});

describe("toolLabelKey", () => {
  it("strips the dynamic connection prefix", () => {
    expect(toolLabelKey("acs_query")).toBe("query");
    expect(toolLabelKey("nexo_list_tables")).toBe("list_tables");
    expect(toolLabelKey("standalone")).toBe("standalone");
  });
});
