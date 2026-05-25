import type {
  HarnessEvent,
  HarnessRunRecord,
  RunMode,
} from "@microboxlabs/miot-harness-client";

export type ToolStatus = "running" | "ok" | "failed";
export type AssistantStatus = "streaming" | "complete" | "failed";
export type ApprovalDecision = "approve" | "deny" | "later";

export type TranscriptItem =
  | { kind: "user"; id: string; text: string; ts: string }
  | {
      kind: "assistant";
      id: string;
      runId: string;
      text: string;
      status: AssistantStatus;
      ts: string;
    }
  | {
      kind: "tool";
      id: string;
      name: string;
      status: ToolStatus;
      message: string | null;
      ts: string;
    }
  | { kind: "route"; id: string; route: string; ts: string }
  | { kind: "agent"; id: string; agent: string; ts: string }
  | {
      kind: "thinking";
      id: string;
      agent: string;
      text: string;
      status: "streaming" | "complete";
      ts: string;
    }
  | { kind: "plan"; id: string; message: string; ts: string }
  | { kind: "freshness"; id: string; message: string; ts: string }
  | { kind: "artifact"; id: string; artifactKind: string; ts: string }
  | { kind: "system"; id: string; text: string; ts: string };

/**
 * Running totals across the conversation. Reset by CLEAR /
 * RESET_CONVERSATION; accumulated turn-over-turn. `lastCostUsd` is
 * the cost of the most recent LLM call (chip footer uses it).
 */
export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  lastAgent: string | null;
  lastCostUsd: number | null;
}

export const ZERO_USAGE: UsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
  lastAgent: null,
  lastCostUsd: null,
};

export interface PendingApproval {
  id: string;
  runId: string;
  message: string;
  data: Record<string, unknown>;
  ts: string;
}

export interface ResolvedApproval {
  id: string;
  decision: ApprovalDecision;
  ts: string;
}

export interface SessionMeta {
  conversationId: string;
  tenantId: string;
  userId: string;
  mode: RunMode;
  baseUrl: string;
  profileName: string | null;
  debug: boolean;
}

export interface SessionState {
  meta: SessionMeta;
  transcript: TranscriptItem[];
  pendingApprovals: PendingApproval[];
  resolvedApprovals: ResolvedApproval[];
  currentRunId: string | null;
  currentAssistantItemId: string | null;
  /** Live thinking item being appended to as deltas arrive; cleared
   * at end-of-turn and at the next BEGIN_TURN. */
  currentThinkingItemId: string | null;
  /** Per-conversation token + cost running totals. */
  usageTotals: UsageTotals;
  warnAgenticTenantMismatch: boolean;
  lastSubmittedPrompt: string | null;
}

export type SessionAction =
  | { kind: "BEGIN_TURN"; prompt: string }
  | { kind: "STREAM_EVENT"; event: HarnessEvent; runId: string }
  | { kind: "END_TURN"; record?: HarnessRunRecord; failureMessage?: string }
  | { kind: "SET_MODE"; mode: RunMode }
  | { kind: "SET_TENANT"; tenant: string }
  | { kind: "SET_USER"; user: string }
  | { kind: "RESET_CONVERSATION" }
  | { kind: "CLEAR" }
  | { kind: "LOAD_SESSION"; state: SessionState }
  | {
      kind: "RECORD_APPROVAL";
      approval: Omit<PendingApproval, "ts"> & { ts?: string };
    }
  | { kind: "RESOLVE_APPROVAL"; id: string; decision: ApprovalDecision };

export interface ReducerContext {
  now: () => string;
  uuid: () => string;
}

export interface SessionMetaInit {
  tenantId: string;
  userId: string;
  mode: RunMode;
  baseUrl: string;
  profileName?: string | null;
  debug?: boolean;
}
