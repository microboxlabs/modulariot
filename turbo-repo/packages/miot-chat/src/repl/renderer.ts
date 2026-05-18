import { bold, CLEAR_LINE, dim, red, yellow, type ColorOptions } from "../output.js";
import {
  TERMINAL_EVENT_TYPES,
  type HarnessEvent,
  type HarnessEventType,
} from "../harness/types.js";

export interface RenderState {
  pendingAnswer: string | null;
  hasStatusLine: boolean;
  color: ColorOptions;
}

export interface RenderResult {
  state: RenderState;
  output: string;
}

export function initialState(color: ColorOptions = {}): RenderState {
  return { pendingAnswer: null, hasStatusLine: false, color };
}

export function renderEvent(
  state: RenderState,
  event: HarnessEvent,
): RenderResult {
  switch (event.type) {
    case "answer.completed":
      return {
        state: {
          ...state,
          pendingAnswer: extractAnswerText(event) ?? state.pendingAnswer,
        },
        output: "",
      };

    case "run.completed":
      return {
        state: { ...state, hasStatusLine: false },
        output: finalAnswerOutput(state),
      };

    case "run.failed":
      return {
        state: { ...state, hasStatusLine: false },
        output: errorOutput(state, event.message || "run failed"),
      };

    default: {
      if (TERMINAL_EVENT_TYPES.has(event.type)) {
        return { state, output: "" };
      }
      const summary = statusFor(event);
      if (summary === null) return { state, output: "" };
      const clearPrefix = state.hasStatusLine ? CLEAR_LINE : "";
      const line = colorize(event.type, summary, state.color);
      return {
        state: { ...state, hasStatusLine: true },
        output: `${clearPrefix}${line}`,
      };
    }
  }
}

export function clearStatus(state: RenderState): RenderResult {
  if (!state.hasStatusLine) return { state, output: "" };
  return { state: { ...state, hasStatusLine: false }, output: CLEAR_LINE };
}

export function renderAuthoritativeAnswer(
  state: RenderState,
  answer: string | null,
): RenderResult {
  const prefix = state.hasStatusLine ? CLEAR_LINE : "";
  const text = answer ?? state.pendingAnswer ?? "(no answer recorded)";
  return {
    state: { ...state, hasStatusLine: false, pendingAnswer: text },
    output: `${prefix}${bold(text, state.color)}\n`,
  };
}

function finalAnswerOutput(state: RenderState): string {
  const prefix = state.hasStatusLine ? CLEAR_LINE : "";
  const text = state.pendingAnswer ?? "(no answer recorded)";
  return `${prefix}${bold(text, state.color)}\n`;
}

function errorOutput(state: RenderState, message: string): string {
  const prefix = state.hasStatusLine ? CLEAR_LINE : "";
  return `${prefix}${red(`error: ${message}`, state.color)}\n`;
}

function extractAnswerText(event: HarnessEvent): string | null {
  const data = event.data;
  if (typeof data?.text === "string" && data.text.length > 0) return data.text;
  if (typeof data?.answer === "string" && data.answer.length > 0) {
    return data.answer;
  }
  return event.message.length > 0 ? event.message : null;
}

function colorize(
  type: HarnessEventType,
  text: string,
  color: ColorOptions,
): string {
  if (type === "freshness.warning") return yellow(text, color);
  if (type === "tool.failed") return red(text, color);
  return dim(text, color);
}

function statusFor(event: HarnessEvent): string | null {
  switch (event.type) {
    case "run.started":
      return "starting…";
    case "route.selected": {
      const route =
        typeof event.data.route === "string"
          ? event.data.route
          : event.message;
      return route ? `route: ${route}` : null;
    }
    case "agent.turn": {
      const agent =
        typeof event.data.agent === "string"
          ? event.data.agent
          : event.message;
      return agent ? `agent: ${agent}` : null;
    }
    case "plan.created":
      return event.message || "plan ready";
    case "tool.started": {
      const name =
        typeof event.data.name === "string" ? event.data.name : event.message;
      return name ? `tool: ${name}` : null;
    }
    case "tool.completed": {
      const name =
        typeof event.data.name === "string" ? event.data.name : event.message;
      return name ? `tool ok: ${name}` : "tool ok";
    }
    case "tool.failed": {
      const name =
        typeof event.data.name === "string" ? event.data.name : event.message;
      return name ? `tool failed: ${name}` : "tool failed";
    }
    case "freshness.warning":
      return event.message || "stale data";
    case "approval.requested":
      return event.message || "approval needed";
    case "artifact.created": {
      const kind =
        typeof event.data.kind === "string" ? event.data.kind : "artifact";
      return `artifact: ${kind}`;
    }
    default:
      return null;
  }
}
