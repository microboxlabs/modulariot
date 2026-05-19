import type { HarnessEvent } from "@microboxlabs/miot-harness-client";
import { isAgenticTenantMismatch } from "./agentic.js";
import type {
  PendingApproval,
  ReducerContext,
  SessionAction,
  SessionMetaInit,
  SessionState,
  ToolStatus,
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

    case "STREAM_EVENT":
      return applyStreamEvent(state, action.event, action.runId, ctx);

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

function applyStreamEvent(
  state: SessionState,
  event: HarnessEvent,
  runId: string,
  ctx: ReducerContext,
): SessionState {
  const ts = ctx.now();

  switch (event.type) {
    case "run.started":
      return { ...state, currentRunId: runId };

    case "run.completed":
    case "run.failed":
      // No transcript mutation; END_TURN orchestrates the final state.
      return state;

    case "answer.completed":
      return upsertAssistantItem(state, event, runId, ctx);

    case "tool.started":
      return appendToolItem(state, event, "running", ts, ctx);

    case "tool.completed":
      return flipOrAppendTool(state, event, "ok", ts, ctx);

    case "tool.failed":
      return flipOrAppendTool(state, event, "failed", ts, ctx);

    case "approval.requested": {
      const message = event.message || "approval needed";
      const systemItem: TranscriptItem = {
        kind: "system",
        id: ctx.uuid(),
        text: `approval requested: ${message}`,
        ts,
      };
      const approval: PendingApproval = {
        id: event.id,
        runId,
        message: event.message,
        data: event.data,
        ts,
      };
      return {
        ...state,
        transcript: [...state.transcript, systemItem],
        pendingApprovals: [...state.pendingApprovals, approval],
      };
    }

    case "route.selected": {
      const route =
        typeof event.data.route === "string" && event.data.route.length > 0
          ? event.data.route
          : event.message;
      if (!route) return state;
      const item: TranscriptItem = {
        kind: "route",
        id: ctx.uuid(),
        route,
        ts,
      };
      return { ...state, transcript: [...state.transcript, item] };
    }

    case "agent.turn": {
      const agent =
        typeof event.data.agent === "string" && event.data.agent.length > 0
          ? event.data.agent
          : event.message;
      if (!agent) return state;
      const item: TranscriptItem = {
        kind: "agent",
        id: ctx.uuid(),
        agent,
        ts,
      };
      return { ...state, transcript: [...state.transcript, item] };
    }

    case "plan.created": {
      const item: TranscriptItem = {
        kind: "plan",
        id: ctx.uuid(),
        message: event.message || "plan ready",
        ts,
      };
      return { ...state, transcript: [...state.transcript, item] };
    }

    case "freshness.warning": {
      const item: TranscriptItem = {
        kind: "freshness",
        id: ctx.uuid(),
        message: event.message || "stale data",
        ts,
      };
      return { ...state, transcript: [...state.transcript, item] };
    }

    case "artifact.created": {
      const artifactKind =
        typeof event.data.kind === "string" && event.data.kind.length > 0
          ? event.data.kind
          : "artifact";
      const item: TranscriptItem = {
        kind: "artifact",
        id: ctx.uuid(),
        artifactKind,
        ts,
      };
      return { ...state, transcript: [...state.transcript, item] };
    }
  }
}

function extractAnswerText(event: HarnessEvent): string {
  const data = event.data;
  if (typeof data?.text === "string" && data.text.length > 0) return data.text;
  if (typeof data?.answer === "string" && data.answer.length > 0) {
    return data.answer;
  }
  return event.message;
}

function upsertAssistantItem(
  state: SessionState,
  event: HarnessEvent,
  runId: string,
  ctx: ReducerContext,
): SessionState {
  const text = extractAnswerText(event);
  const existingId = state.currentAssistantItemId;
  if (existingId) {
    return {
      ...state,
      transcript: state.transcript.map((item) =>
        item.kind === "assistant" && item.id === existingId
          ? { ...item, text, status: "streaming" }
          : item,
      ),
    };
  }
  const id = ctx.uuid();
  const item: TranscriptItem = {
    kind: "assistant",
    id,
    runId,
    text,
    status: "streaming",
    ts: ctx.now(),
  };
  return {
    ...state,
    currentAssistantItemId: id,
    transcript: [...state.transcript, item],
  };
}

function extractToolName(event: HarnessEvent): string {
  return typeof event.data.name === "string" && event.data.name.length > 0
    ? event.data.name
    : event.message;
}

function appendToolItem(
  state: SessionState,
  event: HarnessEvent,
  status: ToolStatus,
  ts: string,
  ctx: ReducerContext,
): SessionState {
  const name = extractToolName(event);
  const item: TranscriptItem = {
    kind: "tool",
    id: ctx.uuid(),
    name,
    status,
    message: event.message.length > 0 ? event.message : null,
    ts,
  };
  return { ...state, transcript: [...state.transcript, item] };
}

function flipOrAppendTool(
  state: SessionState,
  event: HarnessEvent,
  status: ToolStatus,
  ts: string,
  ctx: ReducerContext,
): SessionState {
  const name = extractToolName(event);
  for (let i = state.transcript.length - 1; i >= 0; i -= 1) {
    const item = state.transcript[i];
    if (
      item &&
      item.kind === "tool" &&
      item.status === "running" &&
      item.name === name
    ) {
      const message =
        event.message.length > 0 ? event.message : item.message;
      const updated: TranscriptItem = { ...item, status, message };
      const next = state.transcript.slice();
      next[i] = updated;
      return { ...state, transcript: next };
    }
  }
  return appendToolItem(state, event, status, ts, ctx);
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
