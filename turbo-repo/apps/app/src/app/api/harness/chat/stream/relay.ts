import type { Session } from "next-auth";
import {
  createMiotHarnessClient,
  MiotHarnessApiError,
  TERMINAL_EVENT_TYPES,
  type HarnessEvent,
  type HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";
import {
  resolveTenantScope,
  type TenantScopeResult,
} from "../../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import {
  INITIAL_PROGRESS,
  reduceHarnessStreamEvent,
  type HarnessStreamProgress,
} from "@/features/layout/components/secured-navbar/spotlight-search/harness-stream";
import type { TrFn } from "@/features/i18n/i18n.service.types";
import { modulithHost } from "@/lib/modulith-host";
import {
  approvalCallEvents,
  approvalResultEvent,
  artifactCallEvents,
  chatAnswerEvents,
  shareLinkCallEvents,
  toArtifactSpec,
  type DraftDashlet,
} from "./chat-answer";
import {
  approvalArgsOf,
  approvalResultOf,
} from "@/features/harness-chat/extensions/request-approval-args";
import {
  shareLinkOf,
  storyTitlesOf,
} from "@/features/harness-chat/extensions/show-share-link-args";
import { LiveAnswer } from "./live-answer";
import {
  newLearningCardState,
  trackLearningCards,
  type LearningCardState,
} from "./learning-cards";
import { stepLabel } from "./step-labels";
import { planRefusalMessage } from "./plan-refusal";
import {
  HARNESS_RUN_EVENT,
  type HarnessRunMarker,
} from "@/features/harness-chat/harness-active-run";
import { sessionToken } from "@/features/auth/services/session-auth";

/**
 * The harness side of the chat relay, shared by the route that starts a run
 * and the one that re-attaches to it after a reload: harness events in,
 * AG-UI SSE frames out.
 */

/** A run that is still going after this long is cancelled. Runs that query a
 * lot can take several minutes; a reload re-attaches to them, so this is a
 * safety net, not a budget. */
export const HARNESS_RELAY_MAX_MS = 15 * 60_000;

/** Proxies drop a response that sends nothing for about a minute, and the
 * model can think longer than that without emitting an event. */
export const SSE_KEEPALIVE_MS = 15_000;

const FORWARDED_EVENTS: ReadonlySet<string> = new Set([
  "run.started",
  "agent.started",
  "agent.completed",
  "tool.started",
  "tool.completed",
  "thinking.delta",
  "thinking.completed",
  "advisor.consulted",
  "delegate.completed",
  "answer.completed",
  "run.completed",
  "run.failed",
]);

const SSE_ENCODER = new TextEncoder();
const SSE_KEEPALIVE = SSE_ENCODER.encode(": keepalive\n\n");

function sseFrame(event: Record<string, unknown>): Uint8Array {
  return SSE_ENCODER.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export type Sender = (event: Record<string, unknown>) => void;

/** An SSE response fed by `produce`, with a comment line every
 * `SSE_KEEPALIVE_MS` so idle proxies keep the connection open. */
export function sseResponse(
  produce: (send: Sender) => Promise<void>
): Response {
  let keepalive: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const enqueue = (chunk: Uint8Array) => {
        try {
          ctrl.enqueue(chunk);
        } catch {
          // stream already closed — nothing to release
        }
      };
      keepalive = setInterval(() => enqueue(SSE_KEEPALIVE), SSE_KEEPALIVE_MS);
      try {
        await produce((event) => enqueue(sseFrame(event)));
      } finally {
        clearInterval(keepalive);
        try {
          ctrl.close();
        } catch {
          // already closed/errored
        }
      }
    },
    cancel() {
      clearInterval(keepalive);
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

/** Tells the browser which harness run it is watching, and when that run is
 * over, so it can re-attach to it after a reload. */
export function sendRunMarker(send: Sender, marker: HarnessRunMarker): void {
  send({ type: "CUSTOM", name: HARNESS_RUN_EVENT, value: marker });
}

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
    case "exploring":
      return tr("harnessChat.stream.progress.exploring");
    case "answering":
      return tr("harnessChat.stream.progress.answering");
    default:
      return tr("harnessChat.stream.progress.thinking");
  }
}

/**
 * Live "what the harness is doing" narration: one reasoning message per run,
 * opened once and appended with incremental deltas. Re-sending the whole
 * accumulated text per progress snapshot (the earlier approach) resent
 * `progress.thinking` in full on each of its own `thinking.delta` chunks — a
 * wall of near-duplicate text.
 *
 * REASONING_* not THINKING_*: @ag-ui/client 0.0.57 applies THINKING_* as
 * no-ops, so they never reach the runtime.
 */
type Narrator = {
  messageId: string;
  lastPhase: HarnessStreamProgress["phase"] | null;
  /** How many times each step label has started in this run. */
  stepStarts: Map<string, number>;
  /** The last line says the model is thinking. */
  thinking: boolean;
};

function openNarration(send: Sender): Narrator {
  const messageId = crypto.randomUUID();
  send({ type: "REASONING_START", messageId });
  send({ type: "REASONING_MESSAGE_START", messageId, role: "reasoning" });
  return {
    messageId,
    lastPhase: null,
    stepStarts: new Map(),
    thinking: false,
  };
}

function appendNarration(
  send: Sender,
  narrator: Narrator,
  delta: string
): void {
  if (!delta) return;
  narrator.thinking = false;
  send({
    type: "REASONING_MESSAGE_CONTENT",
    messageId: narrator.messageId,
    delta,
  });
}

/** "Thinking…" as the last line, while the model works on a turn. */
function appendThinking(send: Sender, narrator: Narrator, tr: TrFn): void {
  if (narrator.thinking) return;
  appendNarration(
    send,
    narrator,
    `\n${tr("harnessChat.stream.progress.thinking")}`
  );
  narrator.thinking = true;
}

/** The harness took the run, or its agent starts another model turn. */
function startsModelTurn(event: HarnessEvent): boolean {
  if (event.type === "run.started") return true;
  return (
    event.type === "agent.started" &&
    event.data.agent === "agent_loop" &&
    event.data.delegate_id === undefined
  );
}

function closeNarration(send: Sender, narrator: Narrator): void {
  send({ type: "REASONING_MESSAGE_END", messageId: narrator.messageId });
  send({ type: "REASONING_END", messageId: narrator.messageId });
}

/** Appends a headline when the phase changed. `progress.thinking` itself
 * isn't read here — the caller forwards each `thinking.delta`'s own raw chunk
 * directly, since that already arrives incrementally from the harness. */
function appendNarrationDiff(
  send: Sender,
  narrator: Narrator,
  progress: HarnessStreamProgress,
  tr: TrFn
): void {
  if (progress.phase === narrator.lastPhase) return;
  const prefix = narrator.lastPhase === null ? "" : "\n\n";
  appendNarration(send, narrator, `${prefix}${phaseLabel(progress, tr)}`);
  narrator.lastPhase = progress.phase;
}

/** One line per tool the moment it starts, so the last line is always the
 * step in progress. A label seen before gets its count: "Querying ×3". */
export function stepStartLine(
  stepStarts: Map<string, number>,
  label: string
): string {
  const count = (stepStarts.get(label) ?? 0) + 1;
  stepStarts.set(label, count);
  return count > 1 ? `\n${label} ×${count}` : `\n${label}`;
}

export function sendText(send: Sender, text: string): void {
  const messageId = crypto.randomUUID();
  send({ type: "TEXT_MESSAGE_START", messageId });
  send({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: text });
  send({ type: "TEXT_MESSAGE_END", messageId });
}

export type HarnessClient = ReturnType<typeof createMiotHarnessClient>;

export type HarnessConnection =
  | {
      ok: true;
      client: HarnessClient;
      orgSlug: string;
      token: string | undefined;
      userEmail: string | undefined;
    }
  | { ok: false; errorMessage: string };

/** Resolves tenant scope and builds the harness client — the same chain the
 * search relay uses. Takes the already-authenticated session so callers
 * authenticate once, up front, and a scope lookup already started, if any. */
export async function connectToHarness(
  session: Session,
  scope: Promise<TenantScopeResult> = resolveTenantScope()
): Promise<HarnessConnection> {
  const scopeResult = await scope;
  if (!scopeResult.resolved)
    return { ok: false, errorMessage: "tenant_unresolved" };

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token = sessionToken(session);
  const userEmail = session.user?.email;

  const client = createMiotHarnessClient({
    baseUrl: `${modulithHost()}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: userEmail ? { "X-Dev-User-Email": userEmail } : {},
  });

  return { ok: true, client, orgSlug, token, userEmail };
}

/** How the harness event stream ended. `completed` and `failed` mirror the
 * two terminal events, `interrupted` is a run the harness lost (it restarted
 * mid-run, or no longer knows the run); `truncated` is the stream running dry
 * while the run may still be going. */
type RunOutcome = "completed" | "failed" | "interrupted" | "truncated";

/** A harness stream that sends nothing for this long gets its run's status
 * checked: a harness that restarted can leave the stream open with nothing
 * behind it. */
export const RELAY_IDLE_CHECK_MS = 60_000;

const STATUS_CHECK_TIMEOUT_MS = 10_000;

/** What one relay saw of the run, kept by the caller so it survives a stream
 * that throws. */
type RelayState = {
  tools: string[];
  /** Artifacts already sent as cards while the run was going. */
  shownArtifacts: Set<string>;
  /** Approval cards still open, by approval id: their tool call ids. */
  approvals: Map<string, string>;
  /** Share link URLs already sent as cards. */
  shownLinks: Set<string>;
  /** Story titles the run's tool results named, by story id. */
  storyTitles: Map<string, string>;
  startedAt: string | null;
  /** The answer's text, streamed as the harness writes it. */
  live: LiveAnswer;
  /** Trainer tool results already sent as cards. */
  learning: LearningCardState;
};

/** Narrates one forwarded event: always the phase-diff headline, plus the
 * raw `thinking.delta` chunk when that's what this event is (already
 * incremental from the harness, so it's appended as-is). */
function narrateForwardedEvent(
  send: Sender,
  narrator: Narrator,
  progress: HarnessStreamProgress,
  event: HarnessEvent,
  tr: TrFn
): void {
  appendNarrationDiff(send, narrator, progress, tr);
  if (event.type === "tool.started" && typeof event.data.tool === "string") {
    const label = stepLabel(event.data.tool, tr, event.data.args);
    appendNarration(send, narrator, stepStartLine(narrator.stepStarts, label));
  }
  const line = seatNarration(event);
  if (line) appendNarration(send, narrator, line);
  if (startsModelTurn(event)) appendThinking(send, narrator, tr);
  if (event.type !== "thinking.delta") return;
  const delta = event.data.delta;
  if (typeof delta === "string") appendNarration(send, narrator, delta);
}

/** One narration line for a seat event, or null for any other event. */
export function seatNarration(event: {
  type: string;
  data: Record<string, unknown>;
}): string | null {
  if (event.type === "advisor.consulted") {
    const signal =
      typeof event.data.signal === "string" ? event.data.signal : "?";
    const note =
      typeof event.data.note === "string" ? event.data.note.split("\n")[0] : "";
    const suffix = note ? " — " + note : "";
    return "\nAdvisor: " + signal + suffix;
  }
  if (event.type === "delegate.completed") {
    const tools = Array.isArray(event.data.tools_run)
      ? event.data.tools_run.join(", ")
      : "";
    return tools ? "\nDelegated: ran " + tools : "\nDelegated";
  }
  return null;
}

function isInterruption(data: Record<string, unknown>): boolean {
  return data.reason === "interrupted";
}

/** The run's state as the harness reports it now; null while it is running
 * or cannot be asked. */
async function settledOutcome(
  client: HarnessClient,
  runId: string
): Promise<Exclude<RunOutcome, "truncated"> | null> {
  try {
    const record = await client.runs.get(runId, {
      signal: AbortSignal.timeout(STATUS_CHECK_TIMEOUT_MS),
    });
    if (record.status === "completed") return "completed";
    if (record.status !== "failed") return null;
    const failure = record.events.findLast((e) => e.type === "run.failed");
    return failure && isInterruption(failure.data) ? "interrupted" : "failed";
  } catch (err: unknown) {
    return isUnknownRun(err) ? "interrupted" : null;
  }
}

/**
 * `source`'s items, with `onIdle` asked what to do each time `idleMs` goes by
 * without one: true ends the iteration. The pending read is kept across
 * checks, and `stop` is called on the way out so an abandoned read ends.
 */
async function* withIdleChecks<T>(
  source: AsyncIterable<T>,
  idleMs: number,
  onIdle: () => Promise<boolean>,
  stop: () => void
): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();
  let pending = iterator.next();
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const idle = new Promise<"idle">((resolve) => {
        timer = setTimeout(() => resolve("idle"), idleMs);
      });
      const next = await Promise.race([pending, idle]).finally(() =>
        clearTimeout(timer)
      );
      if (next === "idle") {
        if (await onIdle()) return;
        continue;
      }
      if (next.done) return;
      pending = iterator.next();
      yield next.value;
    }
  } finally {
    pending.catch(() => {});
    stop();
  }
}

/** A call waiting for the user opens an approval card at once; the decision
 * closes it. */
export function trackApproval(
  event: HarnessEvent,
  runId: string,
  send: Sender,
  state: Pick<RelayState, "approvals">
): void {
  if (event.type === "approval.requested") {
    const args = approvalArgsOf(runId, event.data);
    if (!args || state.approvals.has(args.approvalId)) return;
    const toolCallId = crypto.randomUUID();
    state.approvals.set(args.approvalId, toolCallId);
    for (const call of approvalCallEvents(args, toolCallId)) send(call);
  } else if (event.type === "approval.resolved") {
    const approvalId = event.data.approval_id;
    const toolCallId =
      typeof approvalId === "string" ? state.approvals.get(approvalId) : null;
    if (!toolCallId) return;
    state.approvals.delete(approvalId as string);
    send(
      approvalResultEvent(
        toolCallId,
        approvalResultOf(event.data, event.created_at)
      )
    );
  }
}

/** Closes the approval cards a finished run left open. */
export function expireApprovals(
  send: Sender,
  state: Pick<RelayState, "approvals">
): void {
  for (const toolCallId of state.approvals.values()) {
    send(approvalResultEvent(toolCallId, { status: "expired" }));
  }
  state.approvals.clear();
}

/** A share link the agent created is sent as a card at once, so the user
 * gets it even when the answer text leaves it out. */
export function trackShareLink(
  event: HarnessEvent,
  send: Sender,
  state: Pick<RelayState, "shownLinks" | "storyTitles">
): void {
  if (event.type !== "tool.completed") return;
  for (const [id, title] of storyTitlesOf(event.data)) {
    state.storyTitles.set(id, title);
  }
  const link = shareLinkOf(event.data, state.storyTitles);
  if (!link || state.shownLinks.has(link.url)) return;
  state.shownLinks.add(link.url);
  for (const call of shareLinkCallEvents(link)) send(call);
}

/** Answer text goes out as it arrives. A turn that ends in tool calls wrote
 * narration, not the answer, and each turn numbers its text from 0. */
function trackAnswer(event: HarnessEvent, live: LiveAnswer): void {
  const { data } = event;
  if (data.agent !== "agent_loop") return;
  if (event.type === "agent.completed" && data.exit_reason === "tool_calls") {
    live.restart();
  } else if (event.type === "answer.delta" && typeof data.delta === "string") {
    if (data.index === 0) live.restart();
    live.push(data.delta);
  }
}

/** What one event adds to the relay's view of the run: its start time, the
 * tools used, the answer's text, and any artifact or share link, sent as a
 * card at once. */
function trackEvent(
  event: HarnessEvent,
  r: { runId: string; opened: number; send: Sender; state: RelayState }
): void {
  const { runId, send, state } = r;
  if (state.startedAt === null && event.created_at) {
    state.startedAt = event.created_at;
    logger.info(
      { runId, firstEventMs: Math.round(performance.now() - r.opened) },
      "[harness/chat/stream] first harness event"
    );
    sendRunMarker(send, {
      runId,
      status: "running",
      startedAt: event.created_at,
    });
  }
  if (event.type === "tool.started" && typeof event.data.tool === "string") {
    state.tools.push(event.data.tool);
  }
  trackAnswer(event, state.live);
  trackApproval(event, runId, send, state);
  trackShareLink(event, send, state);
  trackLearningCards(event, send, state.learning);
  if (event.type !== "artifact.created") return;
  const spec = toArtifactSpec(event.data);
  if (spec && !state.shownArtifacts.has(spec.id)) {
    state.shownArtifacts.add(spec.id);
    for (const call of artifactCallEvents(spec)) send(call);
  }
}

async function relayHarnessEvents(
  client: HarnessClient,
  runId: string,
  signal: AbortSignal,
  send: Sender,
  narrator: Narrator,
  state: RelayState,
  tr: TrFn
): Promise<RunOutcome> {
  let progress: HarnessStreamProgress = INITIAL_PROGRESS;
  let outcome: RunOutcome = "truncated";
  const opened = performance.now();
  const stream = new AbortController();
  const stopStream = () => stream.abort();
  signal.addEventListener("abort", stopStream);
  if (signal.aborted) stream.abort();
  const events = withIdleChecks(
    client.runs.stream(runId, { signal: stream.signal }),
    RELAY_IDLE_CHECK_MS,
    async () => {
      const settled = await settledOutcome(client, runId);
      if (settled) outcome = settled;
      return settled !== null;
    },
    () => {
      signal.removeEventListener("abort", stopStream);
      stream.abort();
    }
  );

  for await (const event of events) {
    trackEvent(event, { runId, opened, send, state });
    if (FORWARDED_EVENTS.has(event.type)) {
      progress = reduceHarnessStreamEvent(progress, {
        event: event.type,
        data: event.data,
      });
      narrateForwardedEvent(send, narrator, progress, event, tr);
    }
    if (TERMINAL_EVENT_TYPES.has(event.type)) {
      if (event.type === "run.completed") outcome = "completed";
      else outcome = isInterruption(event.data) ? "interrupted" : "failed";
      break;
    }
  }

  return outcome;
}

/** Relays the stream and settles how the run ended. A stream that breaks or
 * runs dry is checked against the run's status: the run may have finished,
 * or the harness may have lost it. */
async function followRun(
  client: HarnessClient,
  harnessRunId: string,
  signal: AbortSignal,
  send: Sender,
  narrator: Narrator,
  state: RelayState,
  tr: TrFn
): Promise<RunOutcome> {
  let outcome: RunOutcome;
  try {
    outcome = await relayHarnessEvents(
      client,
      harnessRunId,
      signal,
      send,
      narrator,
      state,
      tr
    );
  } catch (err: unknown) {
    if (signal.aborted || (err as { name?: string }).name === "AbortError") {
      throw err;
    }
    if (isUnknownRun(err)) return "interrupted";
    logger.warn(
      { err, runId: harnessRunId },
      "[harness/chat/stream] harness stream failed"
    );
    outcome = "truncated";
  }
  if (outcome !== "truncated") return outcome;
  return (await settledOutcome(client, harnessRunId)) ?? "truncated";
}

const RUN_ERROR_MESSAGES: Record<Exclude<RunOutcome, "completed">, string> = {
  failed: "run_failed",
  interrupted: "interrupted",
  truncated: "stream_truncated",
};

export type RelayedRun =
  | { completed: true; tools: string[]; record: HarnessRunRecord }
  | { completed: false };

/**
 * Relays one harness run to the browser from its first event: narration
 * while it runs, then the answer, the thread state and RUN_FINISHED. The
 * harness replays past events, so this also serves a browser re-attaching
 * to a run it lost on reload.
 */
export async function relayRun(args: {
  client: HarnessClient;
  harnessRunId: string;
  runId: string;
  threadId: string;
  signal: AbortSignal;
  send: Sender;
  tr: TrFn;
  /** Dashlets earlier turns showed, for a dashboard draft to reuse. */
  priorDashlets?: Map<string, DraftDashlet>;
}): Promise<RelayedRun> {
  const { client, harnessRunId, runId, threadId, signal, send, tr } = args;
  sendRunMarker(send, { runId: harnessRunId, status: "running" });

  const narrator = openNarration(send);
  appendNarrationDiff(send, narrator, INITIAL_PROGRESS, tr);
  const state: RelayState = {
    tools: [],
    shownArtifacts: new Set(),
    approvals: new Map(),
    shownLinks: new Set(),
    storyTitles: new Map(),
    startedAt: null,
    live: new LiveAnswer(send),
    learning: newLearningCardState(),
  };
  const outcome = await followRun(
    client,
    harnessRunId,
    signal,
    send,
    narrator,
    state,
    tr
  );
  closeNarration(send, narrator);
  // A truncated stream may still have its run waiting; a reload re-attaches.
  if (outcome !== "truncated") expireApprovals(send, state);

  // A run that failed or was lost, and a stream that died mid-flight, all
  // arrive here with no answer to present. RUN_ERROR is terminal on its own,
  // so no RUN_FINISHED follows it. A truncated stream may have left the run
  // alive, so the browser keeps it as the thread's active run and re-attaches
  // on reload; the others are over.
  if (outcome !== "completed") {
    state.live.end();
    logger.error(
      { runId: harnessRunId, outcome },
      "[harness/chat/stream] run did not complete"
    );
    if (outcome !== "truncated") {
      sendRunMarker(send, { runId: harnessRunId, status: "finished" });
    }
    send({ type: "RUN_ERROR", message: RUN_ERROR_MESSAGES[outcome] });
    return { completed: false };
  }

  const record = await client.runs.get(harnessRunId, { signal });
  const answer = chatAnswerEvents(record.answer, record.events, {
    noAnswer: tr("harnessChat.stream.noAnswer"),
    assumptionLabel: tr("harnessChat.stream.assumption"),
    shownArtifacts: state.shownArtifacts,
    priorDashlets: args.priorDashlets,
  });
  if (!state.live.settle(answer)) {
    logger.warn(
      { runId: harnessRunId },
      "[harness/chat/stream] streamed text is not the start of the answer"
    );
  }
  send({
    type: "STATE_SNAPSHOT",
    snapshot: {
      harnessConversationId: record.conversation_id,
      // What the harness holds now, compacted or seeded; the panel stores
      // it with the thread so the next process can be handed it back.
      harnessConversationSummary: record.conversation_summary ?? null,
      // The model the run actually used, stored with the thread so reopening
      // it starts on the same one.
      harnessModelUsed: record.context?.model ?? null,
    },
  });
  sendRunMarker(send, { runId: harnessRunId, status: "finished" });
  send({ type: "RUN_FINISHED", runId, threadId });
  return { completed: true, tools: state.tools, record };
}

/** Aborts when the caller disconnects or the relay has run for
 * `HARNESS_RELAY_MAX_MS`. A disconnect only stops the relay: the harness run
 * carries on, and a reload re-attaches to it. */
export function relaySignal(requestSignal: AbortSignal): {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const stop = () => controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, HARNESS_RELAY_MAX_MS);
  if (requestSignal.aborted) stop();
  requestSignal.addEventListener("abort", stop);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timeout);
      requestSignal.removeEventListener("abort", stop);
    },
  };
}

/** The terminal event for a relay that threw, if the caller is still
 * listening. Only the relay's own time limit cancels the harness run: any
 * other failure may have left it running, and a reload re-attaches to it. */
export function reportRelayFailure(
  err: unknown,
  f: {
    send: Sender;
    tr: TrFn;
    runId: string;
    threadId: string;
    client: HarnessClient;
    harnessRunId: string | null;
    timedOut: boolean;
    aborted: boolean;
  }
): void {
  const isAbort = f.aborted || (err as { name?: string }).name === "AbortError";
  const refusal = planRefusalMessage(err);
  if (refusal) {
    // The seat plan refused the run before it started: an answer to show,
    // not a failure to retry.
    sendText(f.send, f.tr(refusal));
    f.send({ type: "RUN_FINISHED", runId: f.runId, threadId: f.threadId });
  } else if (f.timedOut) {
    logger.error({ err }, "[harness/chat/stream] relay timed out");
    if (f.harnessRunId) {
      f.client.runs
        .cancel(f.harnessRunId, { signal: AbortSignal.timeout(5_000) })
        .catch(() => {});
      sendRunMarker(f.send, { runId: f.harnessRunId, status: "finished" });
    }
    f.send({ type: "RUN_ERROR", message: "timeout" });
  } else if (!isAbort) {
    logger.error({ err }, "[harness/chat/stream] relay failed");
    if (f.harnessRunId && isUnknownRun(err)) {
      sendRunMarker(f.send, { runId: f.harnessRunId, status: "finished" });
    }
    f.send({ type: "RUN_ERROR", message: "stream_failed" });
  }
  // Aborted by the caller disconnecting — nothing left to notify.
}

function isUnknownRun(err: unknown): boolean {
  if (!(err instanceof MiotHarnessApiError)) return false;
  return err.code === "unknown_run_id" || err.status === 404;
}
