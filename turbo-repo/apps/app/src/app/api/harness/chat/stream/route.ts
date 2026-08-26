import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
  type HarnessEvent,
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
import type { CreateStoryArgs } from "@/features/harness-chat/extensions/create-story";
import type { ShowDashletArgs } from "@/features/harness-chat/extensions/show-dashlet";
import { getAllDashlets, getAllDashletMetas } from "@/features/dashboard/dashlets";
import { getDictionary, getLocaleFromHeaders } from "@/features/i18n/i18n.service";
import type { TrFn } from "@/features/i18n/i18n.service.types";

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
 * (triggered by a couple of demo phrases, only reachable while the harness
 * endpoint is unconfigured) as a genuine TOOL_CALL_START/ARGS/END sequence —
 * proving out the AG-UI path extensions will use once the harness can drive
 * it.
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
 * server-side since the narration is streamed as AG-UI THINKING_* events.
 * Own dictionary keys, not the spotlight search panel's `spotlight.progress.*`
 * — those are worded for a different, quick-search surface (e.g. "Searching…"
 * vs. this panel's "Connecting to the harness…") and shouldn't be coupled. */
function phaseLabel(progress: HarnessStreamProgress, tr: TrFn): string {
  switch (progress.phase) {
    case "idle":
    case "connecting":
      return tr("harnessChat.stream.progress.connecting");
    case "routing":
      return progress.route
        ? tr("harnessChat.stream.progress.routingWithRoute", { route: progress.route })
        : tr("harnessChat.stream.progress.routingGeneric");
    case "exploring":
      return tr("harnessChat.stream.progress.exploring");
    case "verifying":
      return tr("harnessChat.stream.progress.verifying");
    case "answering":
      return tr("harnessChat.stream.progress.answering");
    default:
      return tr("harnessChat.stream.progress.thinking");
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
  tr: TrFn,
): void {
  if (progress.phase !== narrator.lastPhase) {
    const prefix = narrator.lastPhase === null ? "" : "\n\n";
    appendNarration(send, narrator, `${prefix}${phaseLabel(progress, tr)}`);
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
function blocksToText(answer: string | null, tr: TrFn): string {
  if (!answer) return tr("harnessChat.stream.noAnswer");
  const blocks = parseAnswerBlocks(answer).filter((b) => b.type !== "intent");
  if (blocks.length === 0) return tr("harnessChat.stream.noAnswer");
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

type AgUiMessage = {
  id: string;
  role: "developer" | "system" | "assistant" | "user" | "tool" | "activity" | "reasoning";
  content?: unknown;
  toolCallId?: string;
};

type RunAgentInputBody = {
  threadId?: string;
  runId?: string;
  state?: { harnessConversationId?: string | null } | null;
  messages?: AgUiMessage[];
};

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

/** Demo trigger for the ask_user_question human tool — only reachable when
 * the harness endpoint is unconfigured (local dev without MIOT_HARNESS_URL),
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
        { label: tr("harnessChat.stream.demo.regions.northAmerica"), description: "us-east, us-west" },
        { label: tr("harnessChat.stream.demo.regions.europe"), description: "eu-west, eu-central" },
        { label: tr("harnessChat.stream.demo.regions.asiaPacific"), description: "ap-southeast" },
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
          description: tr("harnessChat.stream.demo.environment.stagingDescription"),
        },
        {
          label: tr("harnessChat.stream.demo.environment.production"),
          description: tr("harnessChat.stream.demo.environment.productionDescription"),
        },
        {
          label: tr("harnessChat.stream.demo.environment.local"),
          description: tr("harnessChat.stream.demo.environment.localDescription"),
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
  // Loose on purpose, same as demoShowDashlet's fallback below — any phrase
  // with "story"/"stories" in it (create/show/make/new a story, etc.), not
  // just the literal "create a story".
  if (!/\bstor(y|ies)\b/i.test(text)) return false;
  createStoryToolCall(send, { id: crypto.randomUUID().slice(0, 8) });
  return true;
}

type HarnessPathDecision = { handled: true } | { handled: false; message: string };

/** Short-circuits for turns that don't need the real harness at all: an
 * ask_user_question tool result, an empty user message, a demo trigger, or
 * the harness endpoint being unconfigured. Returns `handled: true` once
 * it's fully finished the run itself, or the resolved user message when
 * the caller still needs to drive the real harness. */
function decideHarnessPath(
  send: Sender,
  messages: AgUiMessage[],
  runId: string,
  threadId: string,
  tr: TrFn,
): HarnessPathDecision {
  const toolResult = lastMessageIsToolResult(messages);
  if (toolResult) {
    // Acknowledge the tool result locally — nothing to forward upstream yet,
    // the real harness can't consume these results. Kept neutral since this
    // covers both an ask_user_question answer and a show_dashlet auto-ack.
    sendText(send, tr("harnessChat.stream.gotIt"));
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  const message = lastUserText(messages);
  if (!message) {
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  // Unconditional, unlike the demo triggers below: create_story is purely
  // local (localStorage-backed, no backend behind it at all — see
  // storytelling-store.ts), so there's no "real harness" version of it to
  // eventually replace this with. Gating it behind !MIOT_HARNESS_HOST like
  // the others would just make it a dead phrase in any env with a harness
  // actually configured.
  if (demoCreateStory(send, message)) {
    send({ type: "RUN_FINISHED", runId, threadId });
    return { handled: true };
  }

  if (!MIOT_HARNESS_HOST) {
    if (demoAskUserQuestion(send, message, tr)) {
      send({ type: "RUN_FINISHED", runId, threadId });
      return { handled: true };
    }

    if (demoShowAllDashlets(send, message)) {
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

  return { handled: false, message };
}

type HarnessConnection =
  | {
      ok: true;
      client: ReturnType<typeof createMiotHarnessClient>;
      orgSlug: string;
      token: string | undefined;
      userEmail: string | undefined;
    }
  | { ok: false; errorMessage: string };

/** Resolves tenant scope and builds the harness client — the same chain the
 * search relay uses. Takes the already-authenticated session rather than
 * calling requireAuth() itself: the caller now authenticates once, up front,
 * before any other branch (including the demo/placeholder paths) runs. */
async function connectToHarness(session: Session): Promise<HarnessConnection> {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return { ok: false, errorMessage: "tenant_unresolved" };

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token = session.user?.rawJWT ?? session.user?.ticket ?? undefined;
  const userEmail = session.user?.email;

  const client = createMiotHarnessClient({
    baseUrl: `${MIOT_HARNESS_HOST}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: userEmail ? { "X-Dev-User-Email": userEmail } : {},
  });

  return { ok: true, client, orgSlug, token, userEmail };
}

type RunTelemetry = { route: string | undefined; tools: string[] };

/** Tracks the two pieces of the episode record that live outside
 * `HarnessStreamProgress` — the chosen route and every tool invoked —
 * mutating the shared accumulator in place since both are running tallies
 * for the whole stream, not per-event state. */
function trackRunTelemetry(event: HarnessEvent, telemetry: RunTelemetry): void {
  if (event.type === "route.selected") {
    const r = event.data.route;
    if (typeof r === "string") telemetry.route = r;
  } else if (event.type === "tool.started") {
    const t = event.data.tool;
    if (typeof t === "string") telemetry.tools.push(t);
  }
}

/** Narrates one forwarded event: always the phase-diff headline, plus the
 * raw `thinking.delta` chunk when that's what this event is (already
 * incremental from the harness, so it's appended as-is). */
function narrateForwardedEvent(
  send: Sender,
  narrator: Narrator,
  progress: HarnessStreamProgress,
  event: HarnessEvent,
  tr: TrFn,
): void {
  appendNarrationDiff(send, narrator, progress, tr);
  if (event.type !== "thinking.delta") return;
  const delta = event.data.delta;
  if (typeof delta === "string") appendNarration(send, narrator, delta);
}

/** Relays the harness run's own event stream to the browser as live
 * narration, tracking the route + tools invoked along the way for the
 * episode record. Breaks once a terminal event arrives. */
async function relayHarnessEvents(
  client: ReturnType<typeof createMiotHarnessClient>,
  runId: string,
  signal: AbortSignal,
  send: Sender,
  narrator: Narrator,
  tr: TrFn,
): Promise<RunTelemetry> {
  let progress: HarnessStreamProgress = INITIAL_PROGRESS;
  const telemetry: RunTelemetry = { route: undefined, tools: [] };

  for await (const event of client.runs.stream(runId, { signal })) {
    trackRunTelemetry(event, telemetry);
    if (FORWARDED_EVENTS.has(event.type)) {
      progress = reduceHarnessStreamEvent(progress, { event: event.type, data: event.data });
      narrateForwardedEvent(send, narrator, progress, event, tr);
    }
    if (TERMINAL_EVENT_TYPES.has(event.type)) break;
  }

  return telemetry;
}

export async function POST(request: Request) {
  const rawBody: unknown = await request.json().catch(() => ({}));
  if (!isValidRunAgentInputBody(rawBody)) {
    return NextResponse.json({ error: "invalid_request_body" }, { status: 400 });
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
        await run(send, body, messages, runId, threadId, request.signal, tr);
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
  tr: TrFn,
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
  const { message } = decision;

  const connection = await connectToHarness(authResult.session);
  if (!connection.ok) {
    // RUN_ERROR is terminal on its own — no RUN_FINISHED follows it.
    send({ type: "RUN_ERROR", message: connection.errorMessage });
    return;
  }
  const { client, orgSlug, token, userEmail } = connection;
  const conversationId = body.state?.harnessConversationId ?? null;

  let activeRunId: string | null = null;
  let runSettled = false;
  const cancelUpstreamRun = () => {
    if (!activeRunId || runSettled) return;
    runSettled = true;
    client.runs.cancel(activeRunId, { signal: AbortSignal.timeout(5_000) }).catch(() => {});
  };

  let timedOut = false;
  const controller = new AbortController();
  const abortRelay = () => {
    controller.abort();
    cancelUpstreamRun();
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    abortRelay();
  }, HARNESS_STREAM_TIMEOUT_MS);
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
    appendNarrationDiff(send, narrator, INITIAL_PROGRESS, tr);

    const { route, tools } = await relayHarnessEvents(
      client,
      run_id,
      controller.signal,
      send,
      narrator,
      tr,
    );

    closeNarration(send, narrator);
    runSettled = true;

    const record = await client.runs.get(run_id, { signal: controller.signal });
    sendText(send, blocksToText(record.answer, tr));
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
    if (timedOut) {
      // Unlike a client disconnect, the caller is still listening here — the
      // relay itself gave up, so it needs a terminal event same as any other
      // failure.
      logger.error({ err }, "[harness/chat/stream] relay timed out");
      cancelUpstreamRun();
      send({ type: "RUN_ERROR", message: "timeout" });
    } else if (!isAbort) {
      logger.error({ err }, "[harness/chat/stream] relay failed");
      cancelUpstreamRun();
      send({ type: "RUN_ERROR", message: "stream_failed" });
    }
    // Aborted by the caller disconnecting — no AG-UI event for that case,
    // and nothing left to notify: the listener is already gone.
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortRelay);
  }
}
