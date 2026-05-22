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
  | { kind: "plan"; id: string; message: string; ts: string }
  | { kind: "freshness"; id: string; message: string; ts: string }
  | { kind: "artifact"; id: string; artifactKind: string; ts: string }
  | { kind: "system"; id: string; text: string; ts: string };

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
}

export interface SessionState {
  meta: SessionMeta;
  transcript: TranscriptItem[];
  pendingApprovals: PendingApproval[];
  resolvedApprovals: ResolvedApproval[];
  currentRunId: string | null;
  currentAssistantItemId: string | null;
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
}
