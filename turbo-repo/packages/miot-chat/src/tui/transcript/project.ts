import type { HarnessEvent } from "@microboxlabs/miot-harness-client";
import type {
  PendingApproval,
  TranscriptItem,
  ToolStatus,
  UsageTotals,
} from "../session/types.js";

export interface TranscriptSlice {
  transcript: TranscriptItem[];
  currentAssistantItemId: string | null;
  currentThinkingItemId: string | null;
  pendingApprovals: PendingApproval[];
  currentRunId: string | null;
  usageTotals: UsageTotals;
}

export interface ProjectionContext {
  now: () => string;
  uuid: () => string;
}

export function applyHarnessEvent(
  slice: TranscriptSlice,
  event: HarnessEvent,
  runId: string,
  ctx: ProjectionContext,
): TranscriptSlice {
  switch (event.type) {
    case "run.started":
      return { ...slice, currentRunId: runId };

    case "approval.auto":
    case "steering.mode_denied":
      // Status-only markers (an approval auto-resolved; a steering mode was
      // denied). The session reducer / footer surfaces these; the transcript
      // projector leaves the slice unchanged, like run.completed below. Also
      // keeps this switch exhaustive over HarnessEventType.
      return slice;

    case "run.completed":
    case "run.failed":
      // The session reducer's END_TURN orchestrates the final transition;
      // mid-stream we leave the transcript alone so callers don't have to
      // race the projector against END_TURN.
      return slice;

    case "answer.completed":
      return upsertAssistantItem(slice, event, runId, ctx);

    case "tool.started":
      return appendToolItem(slice, event, "running", ctx);

    case "tool.completed":
      return flipOrAppendTool(slice, event, "ok", ctx);

    case "tool.failed":
      return flipOrAppendTool(slice, event, "failed", ctx);

    case "approval.requested": {
      const ts = ctx.now();
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
        ...slice,
        transcript: [...slice.transcript, systemItem],
        pendingApprovals: [...slice.pendingApprovals, approval],
      };
    }

    case "route.selected": {
      const route =
        typeof event.data.route === "string" && event.data.route.length > 0
          ? event.data.route
          : event.message;
      if (!route) return slice;
      return appendItem(slice, {
        kind: "route",
        id: ctx.uuid(),
        route,
        ts: ctx.now(),
      });
    }

    case "agent.turn":
    case "agent.started": {
      // agent.turn is deprecated; agent.started replaces it. Both
      // render as a single transcript "agent" row marking the
      // graph-node boundary. agent.completed is intentionally
      // dropped here — the transcript shouldn't double-row each
      // agent. The REPL renderer surfaces the duration_ms inline
      // for users who want it.
      const agent =
        typeof event.data.agent === "string" && event.data.agent.length > 0
          ? event.data.agent
          : event.message;
      if (!agent) return slice;
      return appendItem(slice, {
        kind: "agent",
        id: ctx.uuid(),
        agent,
        ts: ctx.now(),
      });
    }

    case "agent.completed":
      // The agent.started row already carries the agent boundary; the
      // duration is surfaced inline by the REPL renderer. Skipping the
      // completed event here keeps the transcript compact (one row per
      // node, not two).
      return slice;

    case "verification.completed":
      // Internal pipeline telemetry (the Phase 3 verify gate's "did we answer
      // it?" verdict). Like agent.completed, it marks an internal node boundary
      // and is intentionally not surfaced as a transcript row; the REPL
      // renderer can show it inline. Keeps this switch exhaustive.
      return slice;

    case "thinking.delta": {
      const delta =
        typeof event.data.delta === "string" ? event.data.delta : "";
      if (!delta) return slice;
      const agent =
        typeof event.data.agent === "string" ? event.data.agent : "synthesizer";
      const existingId = slice.currentThinkingItemId;
      if (existingId) {
        return {
          ...slice,
          transcript: slice.transcript.map((item) =>
            item.kind === "thinking" && item.id === existingId
              ? { ...item, text: item.text + delta }
              : item,
          ),
        };
      }
      const id = ctx.uuid();
      const item: TranscriptItem = {
        kind: "thinking",
        id,
        agent,
        text: delta,
        status: "streaming",
        ts: ctx.now(),
      };
      return {
        ...slice,
        currentThinkingItemId: id,
        transcript: [...slice.transcript, item],
      };
    }

    case "thinking.completed": {
      const existingId = slice.currentThinkingItemId;
      if (!existingId) return slice;
      return {
        ...slice,
        currentThinkingItemId: null,
        transcript: slice.transcript.map((item) =>
          item.kind === "thinking" && item.id === existingId
            ? { ...item, status: "complete" as const }
            : item,
        ),
      };
    }

    case "usage.recorded": {
      const inT =
        typeof event.data.input_tokens === "number"
          ? event.data.input_tokens
          : 0;
      const outT =
        typeof event.data.output_tokens === "number"
          ? event.data.output_tokens
          : 0;
      const cacheR =
        typeof event.data.cache_read_input_tokens === "number"
          ? event.data.cache_read_input_tokens
          : 0;
      const cacheC =
        typeof event.data.cache_creation_input_tokens === "number"
          ? event.data.cache_creation_input_tokens
          : 0;
      const cost =
        typeof event.data.cost_usd === "number" ? event.data.cost_usd : 0;
      const agent =
        typeof event.data.agent === "string" ? event.data.agent : null;
      return {
        ...slice,
        usageTotals: {
          inputTokens: slice.usageTotals.inputTokens + inT,
          outputTokens: slice.usageTotals.outputTokens + outT,
          cacheReadTokens: slice.usageTotals.cacheReadTokens + cacheR,
          cacheCreationTokens: slice.usageTotals.cacheCreationTokens + cacheC,
          costUsd: slice.usageTotals.costUsd + cost,
          lastAgent: agent,
          lastCostUsd:
            typeof event.data.cost_usd === "number" ? event.data.cost_usd : null,
        },
      };
    }

    case "plan.created":
      return appendItem(slice, {
        kind: "plan",
        id: ctx.uuid(),
        message: event.message || "plan ready",
        ts: ctx.now(),
      });

    case "freshness.warning":
      return appendItem(slice, {
        kind: "freshness",
        id: ctx.uuid(),
        message: event.message || "stale data",
        ts: ctx.now(),
      });

    case "artifact.created": {
      const artifactKind =
        typeof event.data.kind === "string" && event.data.kind.length > 0
          ? event.data.kind
          : "artifact";
      return appendItem(slice, {
        kind: "artifact",
        id: ctx.uuid(),
        artifactKind,
        ts: ctx.now(),
      });
    }
  }
}

function appendItem(
  slice: TranscriptSlice,
  item: TranscriptItem,
): TranscriptSlice {
  return { ...slice, transcript: [...slice.transcript, item] };
}

/**
 * Pull the renderable assistant text from an answer.completed event.
 *
 * Returns null when neither data.text nor data.answer carries a payload.
 * The harness sometimes emits answer.completed with only an event.message
 * status marker (e.g. "Synthesized final answer"); rendering that as the
 * assistant body confuses users. Letting it return null keeps the
 * existing transcript item untouched until END_TURN fills it from the
 * authoritative HarnessRunRecord.answer.
 */
function extractAnswerText(event: HarnessEvent): string | null {
  const data = event.data;
  if (typeof data?.text === "string" && data.text.length > 0) return data.text;
  if (typeof data?.answer === "string" && data.answer.length > 0) {
    return data.answer;
  }
  return null;
}

function upsertAssistantItem(
  slice: TranscriptSlice,
  event: HarnessEvent,
  runId: string,
  ctx: ProjectionContext,
): TranscriptSlice {
  const text = extractAnswerText(event);
  const existingId = slice.currentAssistantItemId;
  if (existingId) {
    if (text === null) return slice;
    return {
      ...slice,
      transcript: slice.transcript.map((item) =>
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
    text: text ?? "",
    status: "streaming",
    ts: ctx.now(),
  };
  return {
    ...slice,
    currentAssistantItemId: id,
    transcript: [...slice.transcript, item],
  };
}

const TOOL_VERB_PREFIX_RE =
  /^(Starting|Started|Completed|Finished|Failed|Running|Executing)\s+/i;

/**
 * Strip status-verb prefixes some harness routes emit on tool events
 * (e.g. data.name = "Starting foo" / "Completed foo"). Without this,
 * tool.completed never matches the running tool.started item and the
 * row doesn't collapse.
 */
function normalizeToolName(raw: string): string {
  return raw.replace(TOOL_VERB_PREFIX_RE, "").trim();
}

function extractToolName(event: HarnessEvent): string {
  // The server emits `data.tool`; the legacy `data.name` path is kept
  // as a fallback for older event records persisted on disk.
  const raw =
    typeof event.data.tool === "string" && event.data.tool.length > 0
      ? event.data.tool
      : typeof event.data.name === "string" && event.data.name.length > 0
        ? event.data.name
        : event.message;
  return normalizeToolName(raw);
}

function appendToolItem(
  slice: TranscriptSlice,
  event: HarnessEvent,
  status: ToolStatus,
  ctx: ProjectionContext,
): TranscriptSlice {
  const name = extractToolName(event);
  const item: TranscriptItem = {
    kind: "tool",
    id: ctx.uuid(),
    name,
    status,
    message: event.message.length > 0 ? event.message : null,
    ts: ctx.now(),
  };
  return appendItem(slice, item);
}

function flipOrAppendTool(
  slice: TranscriptSlice,
  event: HarnessEvent,
  status: ToolStatus,
  ctx: ProjectionContext,
): TranscriptSlice {
  const name = extractToolName(event);
  for (let i = slice.transcript.length - 1; i >= 0; i -= 1) {
    const item = slice.transcript[i];
    if (
      item &&
      item.kind === "tool" &&
      item.status === "running" &&
      item.name === name
    ) {
      const message =
        event.message.length > 0 ? event.message : item.message;
      const updated: TranscriptItem = { ...item, status, message };
      const next = slice.transcript.slice();
      next[i] = updated;
      return { ...slice, transcript: next };
    }
  }
  return appendToolItem(slice, event, status, ctx);
}
