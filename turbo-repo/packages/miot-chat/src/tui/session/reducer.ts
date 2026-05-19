import { applyHarnessEvent } from "../transcript/project.js";
import { isAgenticTenantMismatch } from "./agentic.js";
import type {
  PendingApproval,
  ReducerContext,
  SessionAction,
  SessionMetaInit,
  SessionState,
  TranscriptItem,
} from "./types.js";

export function initialSession(
  init: SessionMetaInit,
  ctx: ReducerContext,
): SessionState {
  return {
    meta: {
      conversationId: ctx.uuid(),
      tenantId: init.tenantId,
      userId: init.userId,
      mode: init.mode,
      baseUrl: init.baseUrl,
      profileName: init.profileName ?? null,
    },
    transcript: [],
    pendingApprovals: [],
    resolvedApprovals: [],
    currentRunId: null,
    currentAssistantItemId: null,
    warnAgenticTenantMismatch: isAgenticTenantMismatch(
      init.mode,
      init.tenantId,
    ),
    lastSubmittedPrompt: null,
  };
}

export function reduce(
  state: SessionState,
  action: SessionAction,
  ctx: ReducerContext,
): SessionState {
  switch (action.kind) {
    case "BEGIN_TURN": {
      const item: TranscriptItem = {
        kind: "user",
        id: ctx.uuid(),
        text: action.prompt,
        ts: ctx.now(),
      };
      return {
        ...state,
        transcript: [...state.transcript, item],
        lastSubmittedPrompt: action.prompt,
        currentAssistantItemId: null,
      };
    }

    case "STREAM_EVENT": {
      const slice = applyHarnessEvent(
        {
          transcript: state.transcript,
          currentAssistantItemId: state.currentAssistantItemId,
          pendingApprovals: state.pendingApprovals,
          currentRunId: state.currentRunId,
        },
        action.event,
        action.runId,
        ctx,
      );
      return {
        ...state,
        transcript: slice.transcript,
        currentAssistantItemId: slice.currentAssistantItemId,
        pendingApprovals: slice.pendingApprovals,
        currentRunId: slice.currentRunId,
      };
    }

    case "END_TURN":
      return applyEndTurn(state, action.record, action.failureMessage, ctx);

    case "SET_MODE": {
      const tenant = state.meta.tenantId;
      return {
        ...state,
        meta: { ...state.meta, mode: action.mode },
        warnAgenticTenantMismatch: isAgenticTenantMismatch(
          action.mode,
          tenant,
        ),
      };
    }

    case "SET_TENANT":
      return {
        ...state,
        meta: { ...state.meta, tenantId: action.tenant },
        warnAgenticTenantMismatch: isAgenticTenantMismatch(
          state.meta.mode,
          action.tenant,
        ),
      };

    case "SET_USER":
      return { ...state, meta: { ...state.meta, userId: action.user } };

    case "RESET_CONVERSATION":
      return {
        ...state,
        meta: { ...state.meta, conversationId: ctx.uuid() },
        transcript: [],
        pendingApprovals: [],
        resolvedApprovals: [],
        currentRunId: null,
        currentAssistantItemId: null,
        lastSubmittedPrompt: null,
      };

    case "CLEAR":
      return {
        ...state,
        transcript: [],
        currentAssistantItemId: null,
      };

    case "LOAD_SESSION":
      return action.state;

    case "RECORD_APPROVAL": {
      const approval: PendingApproval = {
        id: action.approval.id,
        runId: action.approval.runId,
        message: action.approval.message,
        data: action.approval.data,
        ts: action.approval.ts ?? ctx.now(),
      };
      return {
        ...state,
        pendingApprovals: [...state.pendingApprovals, approval],
      };
    }

    case "RESOLVE_APPROVAL":
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.filter(
          (a) => a.id !== action.id,
        ),
        resolvedApprovals: [
          ...state.resolvedApprovals,
          { id: action.id, decision: action.decision, ts: ctx.now() },
        ],
      };
  }
}

function applyEndTurn(
  state: SessionState,
  record:
    | {
        answer: string | null;
      }
    | undefined,
  failureMessage: string | undefined,
  ctx: ReducerContext,
): SessionState {
  const ts = ctx.now();
  const assistantId = state.currentAssistantItemId;

  if (failureMessage !== undefined) {
    const transcript = state.transcript.map((item) =>
      item.kind === "assistant" && item.id === assistantId
        ? { ...item, status: "failed" as const }
        : item,
    );
    const systemItem: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: `error: ${failureMessage}`,
      ts,
    };
    return {
      ...state,
      transcript: [...transcript, systemItem],
      currentRunId: null,
      currentAssistantItemId: null,
    };
  }

  if (assistantId === null) {
    if (record && typeof record.answer === "string" && record.answer.length > 0) {
      const item: TranscriptItem = {
        kind: "assistant",
        id: ctx.uuid(),
        runId: state.currentRunId ?? "",
        text: record.answer,
        status: "complete",
        ts,
      };
      return {
        ...state,
        transcript: [...state.transcript, item],
        currentRunId: null,
        currentAssistantItemId: null,
      };
    }
    const placeholder: TranscriptItem = {
      kind: "system",
      id: ctx.uuid(),
      text: "(no answer recorded)",
      ts,
    };
    return {
      ...state,
      transcript: [...state.transcript, placeholder],
      currentRunId: null,
      currentAssistantItemId: null,
    };
  }

  const transcript = state.transcript.map((item) => {
    if (item.kind !== "assistant" || item.id !== assistantId) return item;
    const text =
      record && typeof record.answer === "string" && record.answer.length > 0
        ? record.answer
        : item.text;
    return { ...item, text, status: "complete" as const };
  });

  return {
    ...state,
    transcript,
    currentRunId: null,
    currentAssistantItemId: null,
  };
}
