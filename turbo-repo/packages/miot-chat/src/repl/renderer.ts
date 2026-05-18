import {
  bold,
  CLEAR_LINE,
  dim,
  red,
  useColor,
  yellow,
  type ColorOptions,
} from "../output.js";
// re-export ANSI helpers — kept for tests + downstream consumers.
export { CLEAR_LINE };

function statusPrefix(state: { hasStatusLine: boolean; color: ColorOptions }): string {
  if (!state.hasStatusLine) return "";
  return useColor(state.color) ? CLEAR_LINE : "\n";
}

function statusSuffix(color: ColorOptions): string {
  // In a non-TTY (or NO_COLOR) shell, status lines need explicit newlines
  // because we can't overwrite. In a TTY, the next event's CLEAR_LINE
  // prefix handles the overwrite, so we leave the cursor on the line.
  return useColor(color) ? "" : "\n";
}
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
    case "run.failed":
      return clearStatus(state);

    default: {
      if (TERMINAL_EVENT_TYPES.has(event.type)) {
        return { state, output: "" };
      }
      const summary = statusFor(event);
      if (summary === null) return { state, output: "" };
      const prefix = statusPrefix(state);
      const line = colorize(event.type, summary, state.color);
      const suffix = statusSuffix(state.color);
      return {
        state: {
          ...state,
          hasStatusLine: useColor(state.color) ? true : false,
        },
        output: `${prefix}${line}${suffix}`,
      };
    }
  }
}

export function clearStatus(state: RenderState): RenderResult {
  if (!state.hasStatusLine) return { state, output: "" };
  return { state: { ...state, hasStatusLine: false }, output: statusPrefix(state) };
}

export function renderAuthoritativeAnswer(
  state: RenderState,
  answer: string | null,
): RenderResult {
  const prefix = statusPrefix(state);
  const text = answer ?? state.pendingAnswer ?? "(no answer recorded)";
  return {
    state: { ...state, hasStatusLine: false, pendingAnswer: text },
    output: `${prefix}${bold(text, state.color)}\n`,
  };
}

export function renderRunFailure(
  state: RenderState,
  message: string,
): RenderResult {
  const prefix = statusPrefix(state);
  return {
    state: { ...state, hasStatusLine: false },
    output: `${prefix}${red(`error: ${message || "run failed"}`, state.color)}\n`,
  };
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
