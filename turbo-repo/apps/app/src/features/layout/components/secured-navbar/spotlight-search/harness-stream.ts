/**
 * Pure event→state mapping for the streaming harness search.
 *
 * The stream route (/api/harness/search/stream) relays typed SSE frames, all
 * carrying one flat payload shape (`{tool}`, `{route}`, `{delta}`,
 * `{results}` …) with the event name on the SSE `event:` line. This reducer
 * folds them into the progress state the spotlight renders live — no I/O, no
 * React, so the whole chain-of-thought mapping is unit-testable.
 */
import type { HarnessSearchResult } from "@/app/api/harness/search/search-blocks";

export type HarnessSearchPhase =
  | "idle"
  | "connecting"
  | "routing"
  | "exploring"
  | "verifying"
  | "answering"
  | "done"
  | "error";

export interface HarnessToolStep {
  tool: string;
  status: "running" | "done";
}

export interface HarnessStreamProgress {
  phase: HarnessSearchPhase;
  /** Harness route label (e.g. "data_agentic") from route.selected. */
  route?: string;
  /** Tool invocations in arrival order — the visible chain of thought. */
  steps: HarnessToolStep[];
  /** Synthesizer thinking text, accumulated from thinking.delta frames. */
  thinking: string;
  /** Final results — null until the search.result frame lands. */
  results: HarnessSearchResult[] | null;
}

export const INITIAL_PROGRESS: HarnessStreamProgress = {
  phase: "idle",
  steps: [],
  thinking: "",
  results: null,
};

/** State the instant the user commits a query, before any frame arrives. */
export function startProgress(): HarnessStreamProgress {
  return { ...INITIAL_PROGRESS, phase: "connecting" };
}

/** An SSE frame as parsed off the wire: `event` name + JSON-decoded data. */
export interface HarnessStreamFrame {
  event: string;
  data?: unknown;
}

function eventData(frame: HarnessStreamFrame): Record<string, unknown> {
  return (
    frame.data && typeof frame.data === "object" ? frame.data : {}
  ) as Record<string, unknown>;
}

function completeStep(steps: HarnessToolStep[], tool: string): HarnessToolStep[] {
  const i = steps.findIndex((s) => s.tool === tool && s.status === "running");
  if (i === -1) return steps;
  return steps.map((s, j) => (j === i ? { ...s, status: "done" as const } : s));
}

export function reduceHarnessStreamEvent(
  state: HarnessStreamProgress,
  frame: HarnessStreamFrame,
): HarnessStreamProgress {
  switch (frame.event) {
    case "search.accepted":
      return { ...state, phase: "connecting" };

    case "route.selected": {
      const route = eventData(frame).route;
      return {
        ...state,
        phase: "routing",
        ...(typeof route === "string" && { route }),
      };
    }

    case "tool.started": {
      const tool = eventData(frame).tool;
      if (typeof tool !== "string") return state;
      return {
        ...state,
        phase: "exploring",
        steps: [...state.steps, { tool, status: "running" }],
      };
    }

    case "tool.completed": {
      const tool = eventData(frame).tool;
      if (typeof tool !== "string") return state;
      return { ...state, steps: completeStep(state.steps, tool) };
    }

    case "verification.completed":
      return { ...state, phase: "verifying" };

    case "thinking.delta": {
      const delta = eventData(frame).delta;
      if (typeof delta !== "string") return state;
      return { ...state, phase: "answering", thinking: state.thinking + delta };
    }

    case "answer.completed":
      return { ...state, phase: "answering" };

    case "search.result": {
      const payload = frame.data as { results?: HarnessSearchResult[] } | undefined;
      return { ...state, phase: "done", results: payload?.results ?? [] };
    }

    case "run.failed":
    case "search.error":
      return { ...state, phase: "error" };

    default:
      return state;
  }
}

/**
 * Dictionary key for a tool's human-readable label: the connection prefix is
 * dynamic (acs_query, nexo_select, …) so labels key on the primitive name.
 * Unknown primitives fall back to the raw tool name at render time.
 */
export function toolLabelKey(tool: string): string {
  return tool.replace(/^[a-z0-9]+_/, "");
}
