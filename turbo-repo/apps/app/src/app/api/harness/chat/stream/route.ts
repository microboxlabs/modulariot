import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { recordEpisode } from "../../../interactions/episodes/record-episode";
import { parseAnswerBlocks } from "../../search/search-blocks";
import {
  INITIAL_PROGRESS,
  reduceHarnessStreamEvent,
  type HarnessStreamProgress,
} from "@/features/layout/components/secured-navbar/spotlight-search/harness-stream";
import type { AskUserQuestionArgs } from "@/features/harness-chat/extensions/ask-user-question";

/**
 * AG-UI-compliant streaming relay for the harness-chat panel. Speaks the
 * AG-UI wire protocol (`RunAgentInput` in, `AgUiEvent` SSE frames out) so
 * the browser can run `useAgUiRuntime` against this route directly — see
 * https://github.com/ag-ui-protocol/ag-ui. Underneath, it still drives the
 * same real harness backend the search relay uses (unchanged auth/org-scope
 * chain, unchanged `client.runs.*` calls); only the wire format facing the
 * browser changed. The harness itself has no AG-UI awareness and isn't
 * expected to gain any here — that's future work.
 *
 * `ask_user_question` is a client-side "human" tool the harness cannot
 * invoke yet, so until it can, this relay synthesizes the tool call itself
 * (triggered by a couple of demo phrases, or whenever the harness endpoint
 * is unconfigured) as a genuine TOOL_CALL_START/ARGS/END sequence — proving
 * out the AG-UI path extensions will use once the harness can drive it.
 */

const MIOT_HARNESS_HOST = process.env.MIOT_HARNESS_URL ?? "";

// See search/stream/route.ts's HARNESS_STREAM_TIMEOUT_MS comment — same
// stopgap ceiling applies here.
const HARNESS_STREAM_TIMEOUT_MS = 180_000;

const FORWARDED_EVENTS: ReadonlySet<string> = new Set([
  "run.started",
  "route.selected",
  "agent.started",
  "agent.completed",
  "tool.started",
  "tool.completed",
  "thinking.delta",
  "thinking.completed",
  "verification.completed",
  "answer.completed",
  "run.completed",
  "run.failed",
]);

const SSE_ENCODER = new TextEncoder();

function sseFrame(event: Record<string, unknown>): Uint8Array {
  return SSE_ENCODER.encode(`data: ${JSON.stringify(event)}\n\n`);
}

type Sender = (event: Record<string, unknown>) => void;

/** Same phase→headline mapping the old client-side adapter used, now run
 * server-side since the narration is streamed as AG-UI THINKING_* events. */
function phaseLabel(progress: HarnessStreamProgress): string {
  switch (progress.phase) {
    case "idle":
    case "connecting":
      return "Connecting to the harness…";
    case "routing":
      return progress.route ? `Routing via ${progress.route}…` : "Routing your question…";
    case "exploring":
      return "Exploring your data…";
    case "verifying":
      return "Verifying the answer…";
    case "answering":
      return "Preparing an answer…";
    default:
      return "Thinking…";
  }
}

/**
 * Live "what the harness is doing" narration, streamed as a single
 * continuously-growing AG-UI reasoning message for the whole run (opened
 * once, appended to with genuinely incremental deltas, closed once) —
 * rather than one full-text message per progress snapshot. Re-sending the
 * entire accumulated text on every snapshot (the earlier approach) made
 * `progress.thinking` — itself already an accumulation of many
 * `thinking.delta` chunks — get resent in full on every single one of those
 * chunks, producing a wall of near-duplicate text. Appending only what's
 * new keeps the stream the size of what actually changed.
 *
 * Deliberately REASONING_* rather than the older THINKING_* pair: the
 * installed @ag-ui/client (0.0.57) applies THINKING_* events as pure no-ops
 * (no subscriber callback fires for them at all — confirmed by reading its
 * event-application switch), so they never reach the runtime. REASONING_*
 * is the supported, wired-through equivalent.
 */
type Narrator = {
  messageId: string;
  lastPhase: HarnessStreamProgress["phase"] | null;
  reportedSteps: Set<string>;
};

function openNarration(send: Sender): Narrator {
  const messageId = crypto.randomUUID();
  send({ type: "REASONING_START", messageId });
  send({ type: "REASONING_MESSAGE_START", messageId, role: "reasoning" });
  return { messageId, lastPhase: null, reportedSteps: new Set() };
}

function appendNarration(send: Sender, narrator: Narrator, delta: string): void {
  if (!delta) return;
  send({ type: "REASONING_MESSAGE_CONTENT", messageId: narrator.messageId, delta });
}

function closeNarration(send: Sender, narrator: Narrator): void {
  send({ type: "REASONING_MESSAGE_END", messageId: narrator.messageId });
  send({ type: "REASONING_END", messageId: narrator.messageId });
}

/** Appends only what's new since the last call: a phase-change headline
 * and/or newly-completed tool-step lines. `progress.thinking` itself isn't
 * read here — the caller forwards each `thinking.delta`'s own raw chunk
 * directly, since that already arrives incrementally from the harness. */
function appendNarrationDiff(
  send: Sender,
  narrator: Narrator,
  progress: HarnessStreamProgress,
): void {
  if (progress.phase !== narrator.lastPhase) {
    const prefix = narrator.lastPhase === null ? "" : "\n\n";
    appendNarration(send, narrator, `${prefix}${phaseLabel(progress)}`);
    narrator.lastPhase = progress.phase;
  }
  for (const step of progress.steps) {
    if (step.status !== "done" || narrator.reportedSteps.has(step.tool)) continue;
    narrator.reportedSteps.add(step.tool);
    appendNarration(send, narrator, `\nRan ${step.tool}`);
  }
}

/** The miot-search skill answers with a JSON array of typed blocks — fold
 * them into plain text for the chat bubble (markdown as-is, urls as links). */
function blocksToText(answer: string | null): string {
  if (!answer) return "The harness didn't return an answer.";
  const blocks = parseAnswerBlocks(answer).filter((b) => b.type !== "intent");
  if (blocks.length === 0) return "The harness didn't return an answer.";
  return blocks
    .map((b) => (b.type === "markdown" ? b.value : `[${b.value.name}](${b.value.url})`))
    .join("\n\n");
}

function sendText(send: Sender, text: string): void {
  const messageId = crypto.randomUUID();
  send({ type: "TEXT_MESSAGE_START", messageId });
  send({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: text });
  send({ type: "TEXT_MESSAGE_END", messageId });
}

function askUserQuestionToolCall(send: Sender, args: AskUserQuestionArgs): void {
  const toolCallId = crypto.randomUUID();
  send({ type: "TOOL_CALL_START", toolCallId, toolCallName: "ask_user_question" });
  send({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) });
  send({ type: "TOOL_CALL_END", toolCallId });
}

type AgUiMessage = {
  id: string;
  role: "developer" | "system" | "assistant" | "user" | "tool";
  content?: unknown;
  toolCallId?: string;
};

type RunAgentInputBody = {
  threadId?: string;
  runId?: string;
  state?: { harnessConversationId?: string | null } | null;
  messages?: AgUiMessage[];
};

function lastUserText(messages: AgUiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content.trim();
    if (Array.isArray(m.content)) {
      const text = m.content.find(
        (part): part is { type: "text"; text: string } =>
          typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text",
      );
      return text?.text.trim() ?? "";
    }
  }
  return "";
}

/** True once the most recent message is a tool result answering the
 * `ask_user_question` card we synthesized — i.e. the user just submitted
 * the card. The real harness doesn't consume this yet (out of scope here),
 * so we just acknowledge it and finish the run gracefully. */
function lastMessageIsToolResult(messages: AgUiMessage[]): AgUiMessage | null {
  const last = messages.at(-1);
  return last?.role === "tool" ? last : null;
}

/** Demo triggers for the ask_user_question human tool — used both when the
 * harness endpoint is unconfigured (local dev without MIOT_HARNESS_URL) and
 * whenever the user's message asks for one, so the AG-UI tool-call path
 * stays exercisable without the harness itself being able to invoke it. */
function demoAskUserQuestion(send: Sender, text: string): boolean {
  if (/\bmultiple\b/i.test(text)) {
    askUserQuestionToolCall(send, {
      question: "Which regions should this deploy to?",
      description: "You can pick more than one — the harness will fan out to each.",
      options: [
        { label: "North America", description: "us-east, us-west" },
        { label: "Europe", description: "eu-west, eu-central" },
        { label: "Asia-Pacific", description: "ap-southeast" },
      ],
      allowMultiple: true,
      allowOther: true,
    });
    return true;
  }
  if (/\bquestion\b/i.test(text)) {
    askUserQuestionToolCall(send, {
      question: "Which environment should this run against?",
      description: "This determines which credentials and data source the harness will use.",
      options: [
        { label: "Staging", description: "Safe to experiment, seeded with sample data." },
        { label: "Production", description: "Live data — changes are real." },
        { label: "Local", description: "Your own machine, nothing shared." },
      ],
      allowMultiple: false,
      allowOther: true,
    });
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  const body: RunAgentInputBody = await request.json().catch(() => ({}));
  const runId = body.runId ?? crypto.randomUUID();
  const threadId = body.threadId ?? crypto.randomUUID();
  const messages = body.messages ?? [];

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send: Sender = (event) => {
        try {
          ctrl.enqueue(sseFrame(event));
        } catch {
          // stream already closed — nothing to release
        }
      };
      try {
        await run(send, body, messages, runId, threadId, request.signal);
      } finally {
        try {
          ctrl.close();
        } catch {
          // already closed/errored
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function run(
  send: Sender,
  body: RunAgentInputBody,
  messages: AgUiMessage[],
  runId: string,
  threadId: string,
  requestSignal: AbortSignal,
): Promise<void> {
  send({ type: "RUN_STARTED", runId, threadId });

  const toolResult = lastMessageIsToolResult(messages);
  if (toolResult) {
    // Acknowledge the card's answer locally — nothing to forward upstream
    // yet, the real harness can't consume `ask_user_question` results.
    sendText(send, "Got it — thanks for answering.");
    send({ type: "RUN_FINISHED", runId, threadId });
    return;
  }

  const message = lastUserText(messages);
  if (!message) {
    send({ type: "RUN_FINISHED", runId, threadId });
    return;
  }

  if (demoAskUserQuestion(send, message)) {
    send({ type: "RUN_FINISHED", runId, threadId });
    return;
  }

  if (!MIOT_HARNESS_HOST) {
    sendText(
      send,
      "The harness isn't configured in this environment — this is a placeholder response.",
    );
    send({ type: "RUN_FINISHED", runId, threadId });
    return;
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    // RUN_ERROR is terminal on its own — no RUN_FINISHED follows it.
    send({ type: "RUN_ERROR", message: "unauthenticated" });
    return;
  }

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) {
    send({ type: "RUN_ERROR", message: "tenant_unresolved" });
    return;
  }
  const orgSlug = scopeResult.scope.activeOrg.slug;

  const token = authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;
  const userEmail = authResult.session.user?.email;
  const conversationId = body.state?.harnessConversationId ?? null;

  const client = createMiotHarnessClient({
    baseUrl: `${MIOT_HARNESS_HOST}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: userEmail ? { "X-Dev-User-Email": userEmail } : {},
  });

  let activeRunId: string | null = null;
  let runSettled = false;
  const cancelUpstreamRun = () => {
    if (!activeRunId || runSettled) return;
    runSettled = true;
    client.runs.cancel(activeRunId, { signal: AbortSignal.timeout(5_000) }).catch(() => {});
  };

  const controller = new AbortController();
  const abortRelay = () => {
    controller.abort();
    cancelUpstreamRun();
  };
  const timeout = setTimeout(abortRelay, HARNESS_STREAM_TIMEOUT_MS);
  requestSignal.addEventListener("abort", abortRelay);

  try {
    const { run_id } = await client.runs.create(
      {
        message,
        skill_id: "miot-search",
        answer_format: "json",
        mode: "auto",
        ...(userEmail && { user_id: userEmail }),
        ...(conversationId && { conversation_id: conversationId }),
      },
      { signal: controller.signal },
    );
    activeRunId = run_id;

    const narrator = openNarration(send);
    appendNarrationDiff(send, narrator, INITIAL_PROGRESS);

    let progress: HarnessStreamProgress = INITIAL_PROGRESS;
    let route: string | undefined;
    const tools: string[] = [];

    for await (const event of client.runs.stream(run_id, { signal: controller.signal })) {
      if (event.type === "route.selected") {
        const r = (event.data as { route?: unknown }).route;
        if (typeof r === "string") route = r;
      } else if (event.type === "tool.started") {
        const t = (event.data as { tool?: unknown }).tool;
        if (typeof t === "string") tools.push(t);
      }
      if (FORWARDED_EVENTS.has(event.type)) {
        progress = reduceHarnessStreamEvent(progress, { event: event.type, data: event.data });
        appendNarrationDiff(send, narrator, progress);
        if (event.type === "thinking.delta") {
          const delta = (event.data as { delta?: unknown }).delta;
          if (typeof delta === "string") appendNarration(send, narrator, delta);
        }
      }
      if (TERMINAL_EVENT_TYPES.has(event.type)) break;
    }

    closeNarration(send, narrator);
    runSettled = true;

    const record = await client.runs.get(run_id, { signal: controller.signal });
    sendText(send, blocksToText(record.answer));
    send({ type: "STATE_SNAPSHOT", snapshot: { harnessConversationId: record.conversation_id } });
    send({ type: "RUN_FINISHED", runId, threadId });

    void recordEpisode({
      orgSlug,
      token,
      body: {
        surface: "chat",
        runId: run_id,
        payload: {
          message,
          route,
          tools,
          answer: record.answer,
          conversationId: record.conversation_id,
        },
      },
    });
  } catch (err: unknown) {
    const isAbort =
      controller.signal.aborted || (err as { name?: string }).name === "AbortError";
    if (!isAbort) {
      logger.error({ err }, "[harness/chat/stream] relay failed");
      cancelUpstreamRun();
      send({ type: "RUN_ERROR", message: "stream_failed" });
    }
    // Aborted (the caller disconnected or cancelled) — no AG-UI event for
    // that case, and nothing left to notify: the listener is already gone.
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortRelay);
  }
}
