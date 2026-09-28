import type { HarnessEvent } from "@microboxlabs/miot-harness-client";
import {
  knowledgeChangesOf,
  PROPOSE_KNOWLEDGE_CHANGE_TOOL,
  SCRATCHPAD_WRITE_TOOLS,
  SHOW_KNOWLEDGE_CHANGE_TOOL,
  WORKSPACE_WRITE_TOOLS,
  type ShowKnowledgeChangeArgs,
} from "@/features/harness-chat/extensions/knowledge-change-args";
import {
  learningEvalArgsOf,
  RUN_LEARNING_EVAL_TOOL,
  SHOW_LEARNING_EVAL_TOOL,
} from "@/features/harness-chat/extensions/learning-eval-args";
import {
  SHOW_LEARNING_VIEW_TOOL,
  type LearningView,
} from "@/features/harness-chat/extensions/learning-view-args";
import { resolvedCardEvents } from "./chat-answer";

type Sender = (event: Record<string, unknown>) => void;

const CHANGE_TOOLS: ReadonlySet<string> = new Set([
  PROPOSE_KNOWLEDGE_CHANGE_TOOL,
  ...WORKSPACE_WRITE_TOOLS,
  ...SCRATCHPAD_WRITE_TOOLS,
]);

/** What the relay remembers between a trainer tool's start and its result. */
export type LearningCardState = {
  /** A call's arguments, by call id, for results that leave the path out. */
  args: Map<string, Record<string, unknown>>;
  /** Calls already shown as cards. */
  shown: Set<string>;
};

export function newLearningCardState(): LearningCardState {
  return { args: new Map(), shown: new Set() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A tool preview is the result itself, or its JSON when it had to be cut. */
function previewOf(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Sends a card for a trainer tool's result: the diff of what a knowledge or
 * scratchpad write changed, or an evaluation's summary.
 */
export function trackLearningCards(
  event: HarnessEvent,
  send: Sender,
  state: LearningCardState
): void {
  const { data } = event;
  const tool = typeof data.tool === "string" ? data.tool : null;
  const callId = typeof data.call_id === "string" ? data.call_id : null;
  if (!tool || !callId) return;
  const tracked = CHANGE_TOOLS.has(tool) || tool === RUN_LEARNING_EVAL_TOOL;
  if (!tracked) return;
  if (event.type === "tool.started") {
    if (isRecord(data.args)) state.args.set(callId, data.args);
    return;
  }
  if (event.type !== "tool.completed" || data.ok === false) return;
  if (state.shown.has(callId)) return;
  const preview = previewOf(data.preview);
  const args = state.args.get(callId) ?? {};
  state.args.delete(callId);

  if (tool === RUN_LEARNING_EVAL_TOOL) {
    const card = learningEvalArgsOf(preview);
    if (!card) return;
    state.shown.add(callId);
    for (const e of resolvedCardEvents(SHOW_LEARNING_EVAL_TOOL, card)) send(e);
    return;
  }

  const changes = knowledgeChangesOf(tool, { ...args, ...(preview ?? {}) });
  if (changes.length === 0) return;
  state.shown.add(callId);
  const summary =
    typeof preview?.summary === "string" ? preview.summary : undefined;
  const card: ShowKnowledgeChangeArgs = {
    tool,
    changes,
    ...(summary ? { summary } : {}),
    ...(data.preview_truncated === true ? { truncated: true } : {}),
  };
  for (const e of resolvedCardEvents(SHOW_KNOWLEDGE_CHANGE_TOOL, card)) send(e);
}

/** The workspace view a learning-session command asks for, if any. */
export function learningViewOf(message: string): LearningView | null {
  const command = /^\/(layers|diff)(?:\s|$)/.exec(message.trim());
  return command ? (command[1] as LearningView) : null;
}

/** A card that opens `/layers` or `/diff` in the working area. */
export function sendLearningView(send: Sender, view: LearningView): void {
  for (const e of resolvedCardEvents(SHOW_LEARNING_VIEW_TOOL, { view }))
    send(e);
}
