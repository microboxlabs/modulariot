export type RunMode = "auto" | "canned" | "meta" | "agentic";

export interface UserRequest {
  message: string;
  thread_id?: string;
  tenant_id?: string;
  user_id?: string;
  route_context?: Record<string, unknown>;
  mode?: RunMode;
  conversation_id?: string | null;
}

export type HarnessEventType =
  | "run.started"
  | "route.selected"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "approval.requested"
  | "artifact.created"
  | "plan.created"
  | "agent.turn"
  | "freshness.warning"
  | "answer.completed"
  | "run.completed"
  | "run.failed";

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
