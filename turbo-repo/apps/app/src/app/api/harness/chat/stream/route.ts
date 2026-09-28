import { NextResponse } from "next/server";
import type { Attachment, RunEffort } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { recordEpisode } from "../../../interactions/episodes/record-episode";
import type { AskUserQuestionArgs } from "@/features/harness-chat/extensions/ask-user-question";
import type { CreateStoryArgs } from "@/features/harness-chat/extensions/create-story";
import type { ShowDashletArgs } from "@/features/harness-chat/extensions/show-dashlet";
import {
  getAllDashlets,
  getAllDashletMetas,
} from "@/features/dashboard/dashlets";
import {
  getDictionary,
  getLocaleFromHeaders,
} from "@/features/i18n/i18n.service";
import type { TrFn } from "@/features/i18n/i18n.service.types";
import { isModulithConfigured } from "@/lib/modulith-host";
import {
  conversationOf,
  effortOf,
  lastUserAttachments,
  modelOf,
  type AgUiMessage,
  type RunAgentInputBody,
} from "./conversation";
import { answerFromToolResult } from "./chat-answer";
import { fetchThread, storedThreadModel } from "./thread-model";
import {
  connectToHarness,
  relayRun,
  relaySignal,
  reportRelayFailure,
  sendText,
  sseResponse,
  type Sender,
} from "./relay";

/**
 * AG-UI streaming relay for the harness-chat panel: `RunAgentInput` in,
 * `AgUiEvent` SSE frames out, so the browser drives it with `useAgUiRuntime`
 * directly — see https://github.com/ag-ui-protocol/ag-ui. Underneath it's the
 * same harness backend the search relay uses; only the browser-facing wire
 * format differs. The harness has no AG-UI awareness of its own.
 */

function askUserQuestionToolCall(
  send: Sender,
  args: AskUserQuestionArgs
): void {
  const toolCallId = crypto.randomUUID();
  send({
    type: "TOOL_CALL_START",
    toolCallId,
    toolCallName: "ask_user_question",
  });
  send({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) });
  send({ type: "TOOL_CALL_END", toolCallId });
}

function showDashletToolCall(send: Sender, args: ShowDashletArgs): void {
  const toolCallId = crypto.randomUUID();
  send({ type: "TOOL_CALL_START", toolCallId, toolCallName: "show_dashlet" });
  send({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) });
  send({ type: "TOOL_CALL_END", toolCallId });
}

function createStoryToolCall(send: Sender, args: CreateStoryArgs): void {
  const toolCallId = crypto.randomUUID();
  send({ type: "TOOL_CALL_START", toolCallId, toolCallName: "create_story" });
  send({ type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(args) });
  send({ type: "TOOL_CALL_END", toolCallId });
}

// The full AG-UI role set (confirmed against @ag-ui/core's message schema) —
// "reasoning" matters in particular: this route's own narration streams as
// REASONING_* events, which the client stores as role:"reasoning" messages
// in thread history and echoes back on the next turn. Missing it here made
// every second message in a conversation fail validation.
const AG_UI_MESSAGE_ROLES: ReadonlySet<string> = new Set([
  "developer",
  "system",
  "assistant",
  "user",
  "tool",
  "activity",
  "reasoning",
]);

function isValidAgUiMessage(value: unknown): value is AgUiMessage {
  if (typeof value !== "object" || value === null) return false;
  const role = (value as { role?: unknown }).role;
  return typeof role === "string" && AG_UI_MESSAGE_ROLES.has(role);
}

/** Guards the two fields this route actually reads off the parsed body
 * (`messages`, walked by lastUserText/lastMessageIsToolResult) — malformed
 * JSON here (e.g. `messages` sent as a non-array) would otherwise reach
 * `messages.at(-1)` in lastMessageIsToolResult and throw, since not every
 * type has an `.at` method. */
function isValidRunAgentInputBody(body: unknown): body is RunAgentInputBody {
  if (typeof body !== "object" || body === null) return false;
  const messages = (body as { messages?: unknown }).messages;
  if (messages === undefined) return true;
  return Array.isArray(messages) && messages.every(isValidAgUiMessage);
}

function lastUserText(messages: AgUiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content.trim();
    if (Array.isArray(m.content)) {
      const text = m.content.find(
        (part): part is { type: "text"; text: string } =>
          typeof part === "object" &&
          part !== null &&
          (part as { type?: unknown }).type === "text" &&
          // `isValidRunAgentInputBody` only guards each message's `role`, so a
          // part can arrive as `{ type: "text", text: 1 }` — without this the
          // `.trim()` below throws, and it throws from `decideHarnessPath`,
          // outside `run`'s try/catch, closing the SSE stream after
          // RUN_STARTED with no terminal event at all.
          typeof (part as { text?: unknown }).text === "string"
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

/** Demo trigger for the ask_user_question human tool — only reachable when
 * the harness endpoint is unconfigured (local dev without MIOT_MODULITH_URL),
 * so the AG-UI tool-call path stays exercisable without the harness itself
 * being able to invoke it, without ever intercepting real traffic once a
 * harness is actually configured. */
function demoAskUserQuestion(send: Sender, text: string, tr: TrFn): boolean {
  if (/\bmultiple\b/i.test(text)) {
    askUserQuestionToolCall(send, {
      question: tr("harnessChat.stream.demo.regions.question"),
      description: tr("harnessChat.stream.demo.regions.description"),
      options: [
        // Region codes are technical shorthand, not translatable prose.
        {
          label: tr("harnessChat.stream.demo.regions.northAmerica"),
          description: "us-east, us-west",
        },
        {
          label: tr("harnessChat.stream.demo.regions.europe"),
          description: "eu-west, eu-central",
        },
        {
          label: tr("harnessChat.stream.demo.regions.asiaPacific"),
          description: "ap-southeast",
        },
      ],
      allowMultiple: true,
      allowOther: true,
    });
    return true;
  }
  if (/\bquestion\b/i.test(text)) {
    askUserQuestionToolCall(send, {
      question: tr("harnessChat.stream.demo.environment.question"),
      description: tr("harnessChat.stream.demo.environment.description"),
      options: [
        {
          label: tr("harnessChat.stream.demo.environment.staging"),
          description: tr(
            "harnessChat.stream.demo.environment.stagingDescription"
          ),
        },
        {
          label: tr("harnessChat.stream.demo.environment.production"),
          description: tr(
            "harnessChat.stream.demo.environment.productionDescription"
          ),
        },
        {
          label: tr("harnessChat.stream.demo.environment.local"),
          description: tr(
            "harnessChat.stream.demo.environment.localDescription"
          ),
        },
      ],
      allowMultiple: false,
      allowOther: true,
    });
    return true;
  }
  return false;
}

/** Finds a literal dashlet registry id mentioned in the user's message, e.g.
 * "show me a text_card dashlet" → "text_card". Lets the demo trigger below
 * test any registered dashlet by name, not just the stat_icon default. */
function findNamedDashletId(text: string): string | undefined {
  return getAllDashletMetas()
    .map((meta) => meta.id)
    .find((id) => new RegExp(String.raw`\b${id}\b`, "i").test(text));
}

/** Demo trigger that fires every show_dashlet-eligible dashlet as its own
 * tool call in one run, each with its own defaultConfig — a quick visual
 * survey of what's rendered correctly in chat. Dashlets with
 * showInChat: false are skipped here since they'd just render empty or
 * redundant; naming one directly still works, ShowDashletCard shows an
 * explicit "not supported" message for those. */
function demoShowAllDashlets(send: Sender, text: string): boolean {
  if (!/\b(all|every)\s+dashlets?\b/i.test(text)) return false;
  for (const dashlet of getAllDashlets()) {
    if (dashlet.showInChat === false) continue;
    showDashletToolCall(send, { dashletId: dashlet.meta.id });
  }
  return true;
}

/** Demo trigger for the show_dashlet extension — renders a real dashboard
 * dashlet with static demo data, no live backend calls, so the "dashlets in
 * chat" mechanism is provable before the real harness knows how to invoke
 * it. Naming a registered dashlet id (e.g. "text_card") renders that one
 * using its own defaultConfig; the generic "dashlet"/"stat card"/"widget"
 * phrasing falls back to a stat_icon demo with custom sample data. */
function demoShowDashlet(send: Sender, text: string, tr: TrFn): boolean {
  const namedId = findNamedDashletId(text);
  if (namedId) {
    showDashletToolCall(send, { dashletId: namedId });
    return true;
  }

  if (!/\b(dashlet|stat\s*card|widget)\b/i.test(text)) return false;
  showDashletToolCall(send, {
    dashletId: "stat_icon",
    config: {
      dataMode: "static",
      staticData: JSON.stringify({
        title: tr("harnessChat.stream.demo.dashlet.title"),
        value: "156",
        unit: "items",
      }),
      title: "{{row.title}}",
      value: "{{row.value}}",
      unit: "{{row.unit}}",
      cardVariant: "horizontal",
      showIcon: true,
      icon: "cart",
    },
  });
  return true;
}

/** Demo trigger for the create_story human tool — makes a new /storytelling/{id}
 * entry "AI generated", entirely client-side (see create-story-card.tsx):
 * this route can't touch the browser's localStorage itself, so it only hands
 * the tool call a fresh id and lets the card do the actual creation. Nothing
 * renders in the chat for this one — that's the point (see CreateStoryCard). */
function demoCreateStory(send: Sender, text: string): boolean {
  // Needs an explicit creation verb before "story"/"stories" — "create a
  // story", "make me a new story", etc. — so unrelated prompts that merely
  // mention a story ("summarize user story 123") still reach the harness.
  if (!/\b(?:create|make|generate|new|build)\b.*\bstor(?:y|ies)\b/i.test(text))
    return false;
  createStoryToolCall(send, { id: crypto.randomUUID().slice(0, 8) });
  return true;
}

export type HarnessPathDecision =
  | { handled: true }
  | { handled: false; message: string; attachments?: Attachment[] };

function toHarness(message: string, attachments: Attachment[]): HarnessPathDecision {
  return attachments.length > 0
    ? { handled: false, message, attachments }
    : { handled: false, message };
}

function isEmptyTurn(message: string, attachments: Attachment[]): boolean {
  return !message && attachments.length === 0;
}

/** A tool result while the harness is configured: the user's pick on an
 * ask_user_question card is their next turn; a widget's automatic
 * acknowledgement needs no reply at all. */
function decideToolResultPath(
  send: Sender,
  messages: AgUiMessage[],
  runId: string,
  threadId: string
): HarnessPathDecision {
  const answer = answerFromToolResult(messages);
  if (answer) return { handled: false, message: answer };
  send({ type: "RUN_FINISHED", runId, threadId });
  return { handled: true };
}

/** Short-circuits for turns that don't need the real harness at all: an
 * ask_user_question tool result, an empty user message, a demo trigger, or
 * the harness endpoint being unconfigured. Returns `handled: true` once
 * it's fully finished the run itself, or the resolved user message when
 * the caller still needs to drive the real harness. */
export function decideHarnessPath(
  send: Sender,
  messages: AgUiMessage[],
  runId: string,
  threadId: string,
  tr: TrFn
): HarnessPathDecision {
  const toolResult = lastMessageIsToolResult(messages);
  if (toolResult && isModulithConfigured()) {
    return decideToolResultPath(send, messages, runId, threadId);
  }
  if (toolResult) {
    // Acknowledge the tool result locally — nothing to forward upstream yet,
    // the real harness can't consume these results. Kept neutral since this
    // covers both an ask_user_question answer and a show_dashlet auto-ack.
    sendText(send, tr("harnessChat.stream.gotIt"));
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  const message = lastUserText(messages);
  const attachments = lastUserAttachments(messages);
  if (isEmptyTurn(message, attachments)) {
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  // Both storytelling-related trigger words — "create a story" and "show
  // all dashlets" — are testing scaffolding, gated the same as the
  // storytelling pages themselves (see ENABLE_STORYTELLING in
  // runtime-config.types.ts).
  const storytellingTestingEnabled = process.env.ENABLE_STORYTELLING === "true";

  if (!isModulithConfigured()) {
    // Demo triggers only ever run as a stand-in for the real harness — they
    // must stay inside this branch. `demoCreateStory` used to run ahead of
    // this check, so with the flag on, any real (configured-harness) turn
    // that merely mentioned "story"/"stories" got hijacked into a fake
    // create_story card instead of reaching the actual harness.
    if (storytellingTestingEnabled && demoCreateStory(send, message)) {
      send({ type: "RUN_FINISHED", runId, threadId });
      return { handled: true };
    }

    if (demoAskUserQuestion(send, message, tr)) {
      send({ type: "RUN_FINISHED", runId, threadId });
      return { handled: true };
    }

    if (storytellingTestingEnabled && demoShowAllDashlets(send, message)) {
      send({ type: "RUN_FINISHED", runId, threadId });
      return { handled: true };
    }

    if (demoShowDashlet(send, message, tr)) {
      send({ type: "RUN_FINISHED", runId, threadId });
      return { handled: true };
    }

    sendText(send, tr("harnessChat.stream.unconfigured"));
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  return toHarness(message, attachments);
}

export async function POST(request: Request) {
  const rawBody: unknown = await request.json().catch(() => ({}));
  if (!isValidRunAgentInputBody(rawBody)) {
    return NextResponse.json(
      { error: "invalid_request_body" },
      { status: 400 }
    );
  }
  const body = rawBody;
  const runId = body.runId ?? crypto.randomUUID();
  const threadId = body.threadId ?? crypto.randomUUID();
  const messages = body.messages ?? [];
  // No explicit lang param travels with this request (it's driven by
  // HttpAgent, not a page fetch) — Accept-Language is the only locale signal
  // available here, same fallback the search relay's dictionary lookup uses.
  const locale = getLocaleFromHeaders(request.headers);
  const [tr] = await getDictionary(locale);

  return sseResponse((send) =>
    run(send, body, messages, runId, threadId, request.signal, tr)
  );
}

/** The per-turn fields of a run request, left out when unset. */
function turnOptions(
  attachments: Attachment[] | undefined,
  effort: RunEffort | null
): { attachments?: Attachment[]; effort?: RunEffort } {
  return {
    ...(attachments && { attachments }),
    ...(effort && { effort }),
  };
}

async function run(
  send: Sender,
  body: RunAgentInputBody,
  messages: AgUiMessage[],
  runId: string,
  threadId: string,
  requestSignal: AbortSignal,
  tr: TrFn
): Promise<void> {
  send({ type: "RUN_STARTED", runId, threadId });

  // Authenticate before anything else — including the demo/placeholder
  // branches in decideHarnessPath, which would otherwise run for anonymous
  // callers hitting this route directly (no auth middleware sits in front
  // of it; the page-level (secured) layout only gates the browser UI).
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    send({ type: "RUN_ERROR", message: "unauthenticated" });
    return;
  }

  const decision = decideHarnessPath(send, messages, runId, threadId, tr);
  if (decision.handled) return;
  const { message, attachments } = decision;

  const connection = await connectToHarness(authResult.session);
  if (!connection.ok) {
    // RUN_ERROR is terminal on its own — no RUN_FINISHED follows it.
    send({ type: "RUN_ERROR", message: connection.errorMessage });
    return;
  }
  const { client, orgSlug, token, userEmail } = connection;
  const { conversationId, replayTurns, summary } = conversationOf(
    body,
    messages
  );
  const model =
    modelOf(body) ??
    (conversationId
      ? await storedThreadModel(
          () => fetchThread(orgSlug, conversationId, token, userEmail),
          () => client.models.list()
        )
      : null);

  const effort = effortOf(body);

  const relay = relaySignal(requestSignal);
  let harnessRunId: string | null = null;
  try {
    if (relay.signal.aborted) return;
    const { run_id } = await client.runs.create(
      {
        message,
        ...turnOptions(attachments, effort),
        skill_id: "miot-analyst",
        answer_format: "json",
        ...(model && { model }),
        ...(userEmail && { user_id: userEmail }),
        ...(conversationId && { conversation_id: conversationId }),
        ...(replayTurns.length > 0 && { conversation_history: replayTurns }),
        ...(summary && { conversation_summary: summary }),
      },
      // Not the relay signal: a start aborted mid-flight could still create
      // a run whose id nobody ever learns.
      { signal: AbortSignal.timeout(30_000) }
    );
    harnessRunId = run_id;
    if (relay.signal.aborted) {
      // Gone (Stop or reload) before the browser was told the run id: it can
      // neither re-attach nor stop it later.
      client.runs
        .cancel(run_id, { signal: AbortSignal.timeout(5_000) })
        .catch(() => {});
      return;
    }

    const relayed = await relayRun({
      client,
      harnessRunId: run_id,
      runId,
      threadId,
      signal: relay.signal,
      send,
      tr,
    });
    if (!relayed.completed) return;

    void recordEpisode({
      orgSlug,
      token,
      body: {
        surface: "chat",
        runId: run_id,
        payload: {
          message,
          tools: relayed.tools,
          answer: relayed.record.answer,
          conversationId: relayed.record.conversation_id,
        },
      },
    });
  } catch (err: unknown) {
    reportRelayFailure(err, {
      send,
      tr,
      runId,
      threadId,
      client,
      harnessRunId,
      timedOut: relay.timedOut(),
      aborted: relay.signal.aborted,
    });
  } finally {
    relay.dispose();
  }
}
