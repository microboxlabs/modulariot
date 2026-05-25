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
} from "@microboxlabs/miot-harness-client";

export interface RenderState {
  pendingAnswer: string | null;
  hasStatusLine: boolean;
  /**
   * Concatenated thinking text seen so far this turn. Resets at the
   * next `run.started`. Kept on state so tests can introspect it.
   */
  pendingThinking: string;
  /**
   * True while we're streaming a dimmed `thinking.delta` block. Drives
   * the leading newline before the final answer so the bold answer
   * isn't glued to the dim thinking text.
   */
  hasThinkingBlock: boolean;
  color: ColorOptions;
}

export interface RenderResult {
  state: RenderState;
  output: string;
}

export function initialState(color: ColorOptions = {}): RenderState {
  return {
    pendingAnswer: null,
    hasStatusLine: false,
    pendingThinking: "",
    hasThinkingBlock: false,
    color,
  };
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

    case "thinking.delta": {
      const delta =
        typeof event.data.delta === "string" ? event.data.delta : "";
      if (!delta) return { state, output: "" };
      // Thinking is append-only and spans multiple lines — no CLEAR_LINE.
      // If a status line was up, flush a newline first so we don't glue
      // the dim thinking onto the end of a status line.
      const prefix = state.hasStatusLine ? statusPrefix(state) : "";
      return {
        state: {
          ...state,
          hasStatusLine: false,
          pendingThinking: state.pendingThinking + delta,
          hasThinkingBlock: true,
        },
        output: `${prefix}${dim(delta, state.color)}`,
      };
    }

    case "thinking.completed": {
      // Close the dimmed block with a newline so the next status line
      // or the final answer starts on a fresh row.
      const output = state.hasThinkingBlock ? "\n" : "";
      return {
        state: { ...state, hasThinkingBlock: false },
        output,
      };
    }

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
  // If a thinking block was streaming, insert a blank line before the
  // bold answer so it's visually separated from the dim text.
  const lead = state.hasThinkingBlock ? "\n" : "";
  return {
    state: {
      ...state,
      hasStatusLine: false,
      hasThinkingBlock: false,
      pendingAnswer: text,
    },
    output: `${lead}${prefix}${bold(text, state.color)}\n`,
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
  if (type === "agent.started" || type === "agent.completed") {
    return bold(text, color);
  }
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
    case "agent.started": {
      const agent =
        typeof event.data.agent === "string"
          ? event.data.agent
          : event.message;
      return agent ? `▶ ${agent}` : null;
    }
    case "agent.completed": {
      const agent =
        typeof event.data.agent === "string"
          ? event.data.agent
          : event.message;
      const ms =
        typeof event.data.duration_ms === "number"
          ? event.data.duration_ms
          : null;
      if (!agent) return null;
      return ms !== null ? `✓ ${agent} (${ms}ms)` : `✓ ${agent}`;
    }
    case "plan.created":
      return event.message || "plan ready";
    case "tool.started": {
      const name = toolName(event);
      if (!name) return null;
      const keys = Array.isArray(event.data.input_keys)
        ? (event.data.input_keys as string[]).join(",")
        : "";
      return keys ? `tool: ${name}(${keys})` : `tool: ${name}`;
    }
    case "tool.completed": {
      const name = toolName(event);
      const shape = event.data.result_shape as
        | { type?: string; length?: number }
        | undefined;
      const tail =
        shape && typeof shape.type === "string"
          ? ` → ${shape.type}[${shape.length ?? 0}]`
          : "";
      if (!name) return "tool ok";
      return `tool ok: ${name}${tail}`;
    }
    case "tool.failed": {
      const name = toolName(event);
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
    case "usage.recorded": {
      const agent =
        typeof event.data.agent === "string" ? event.data.agent : "";
      const inT =
        typeof event.data.input_tokens === "number"
          ? event.data.input_tokens
          : 0;
      const outT =
        typeof event.data.output_tokens === "number"
          ? event.data.output_tokens
          : 0;
      return agent ? `usage: ${agent} in=${inT} out=${outT}` : null;
    }
    default:
      return null;
  }
}

function toolName(event: HarnessEvent): string {
  // The server emits `data.tool`; older renderer versions read
  // `data.name` which never matched — fixed here. Fall back to the
  // message so we never render an empty `tool: ` line.
  if (typeof event.data.tool === "string") return event.data.tool;
  if (typeof event.data.name === "string") return event.data.name;
  return event.message;
}
