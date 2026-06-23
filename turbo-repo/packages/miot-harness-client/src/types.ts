export type RunMode = "auto" | "canned" | "meta" | "agentic";

export interface UserRequest {
  message: string;
  thread_id?: string;
  tenant_id?: string;
  user_id?: string;
  route_context?: Record<string, unknown>;
  mode?: RunMode;
  conversation_id?: string | null;
  /**
   * When true, the SSE stream carries full tool inputs and truncated
   * tool outputs (~2 KB cap). Off by default. Coordinador outputs
   * contain customer/fleet data — gate this behind auth in production.
   */
  debug?: boolean;
}

/**
 * Source-of-truth list of HarnessEventType literals. Mirrored from
 * the Python `HarnessEventType` Literal in
 * `miot-harness/src/miot_harness/runtime/events.py` and pinned to the
 * shared `event_types.json` fixture by tests on both sides — if you
 * add a literal here you must also add it to events.py and
 * event_types.json or both test suites will fail.
 */
export const HARNESS_EVENT_TYPES = [
  "run.started",
  "route.selected",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "approval.requested",
  "approval.auto",
  "decision.requested",
  "decision.resolved",
  "steering.mode_denied",
  "steering.injected",
  "artifact.created",
  "plan.created",
  /** @deprecated superseded by agent.started / agent.completed. */
  "agent.turn",
  "agent.started",
  "agent.completed",
  "thinking.delta",
  "thinking.completed",
  "usage.recorded",
  "freshness.warning",
  "answer.completed",
  "run.completed",
  "run.failed",
  "run.interrupted",
] as const;

export type HarnessEventType = (typeof HARNESS_EVENT_TYPES)[number];

export interface AgentStartedData {
  agent: string;
  graph: "nexo" | "agentic";
  turn: number;
}

export interface AgentCompletedData {
  agent: string;
  graph: "nexo" | "agentic" | "meta";
  duration_ms: number;
  exit_reason: "ok" | "failure" | "next_action";
  error?: string;
}

export interface ToolStartedData {
  tool: string;
  input_keys: string[];
  /**
   * Present only when the run was created with `debug=true`. May be
   * the raw dict, or — when the serialized payload exceeded the 2 KB
   * SSE-frame cap — a truncated JSON string slice. Check `truncated`
   * to disambiguate.
   */
  input?: unknown;
  /** Present only when the run was created with `debug=true`. */
  truncated?: boolean;
}

export interface ToolCompletedData {
  tool: string;
  result_shape: { type: string; length: number };
  /** Present only when the run was created with `debug=true`. */
  output?: unknown;
  /** Present only when the run was created with `debug=true`. */
  truncated?: boolean;
  // Lifted metadata from the tool output (when present):
  source?: string;
  refreshed_at?: string;
  layer?: string;
  domain?: string[];
  [key: string]: unknown;
}

export interface ThinkingDeltaData {
  agent: "synthesizer";
  delta: string;
  index: number;
}

export interface ThinkingCompletedData {
  agent: "synthesizer";
  tokens: number;
  length: number;
}

export interface UsageRecordedData {
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd?: number;
}

export const TERMINAL_EVENT_TYPES = new Set<HarnessEventType>([
  "run.completed",
  "run.failed",
]);

export interface HarnessEvent {
  id: string;
  run_id: string;
  seq: number;
  type: HarnessEventType;
  message: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface HarnessRunRecord {
  run_id: string;
  status: string;
  events: HarnessEvent[];
  artifacts: Array<Record<string, unknown>>;
  answer: string | null;
  conversation_id: string | null;
}

export interface ErrorResponse {
  message?: string;
  error?: string;
  detail?: string;
  run_id?: string;
  [key: string]: unknown;
}

export interface ClientConfig {
  baseUrl: string;
  token?: string | null;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}
