import type { Session } from "next-auth";
import {
  createMiotHarnessClient,
  MiotHarnessApiError,
  TERMINAL_EVENT_TYPES,
  type HarnessEvent,
  type HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import {
  INITIAL_PROGRESS,
  reduceHarnessStreamEvent,
  type HarnessStreamProgress,
} from "@/features/layout/components/secured-navbar/spotlight-search/harness-stream";
import type { TrFn } from "@/features/i18n/i18n.service.types";
import { modulithHost } from "@/lib/modulith-host";
import { chatAnswerEvents } from "./chat-answer";
import { stepLabel } from "./step-labels";
import { planRefusalMessage } from "./plan-refusal";
import {
  HARNESS_RUN_EVENT,
  type HarnessRunMarker,
} from "@/features/harness-chat/harness-active-run";

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
  reportedSteps: Set<string>;
};

function openNarration(send: Sender): Narrator {
  const messageId = crypto.randomUUID();
  send({ type: "REASONING_START", messageId });
  send({ type: "REASONING_MESSAGE_START", messageId, role: "reasoning" });
  return { messageId, lastPhase: null, reportedSteps: new Set() };
}

function appendNarration(
  send: Sender,
  narrator: Narrator,
  delta: string
): void {
  if (!delta) return;
  send({
    type: "REASONING_MESSAGE_CONTENT",
    messageId: narrator.messageId,
    delta,
  });
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
  tr: TrFn
): void {
  if (progress.phase !== narrator.lastPhase) {
    const prefix = narrator.lastPhase === null ? "" : "\n\n";
    appendNarration(send, narrator, `${prefix}${phaseLabel(progress, tr)}`);
    narrator.lastPhase = progress.phase;
  }
  for (const step of progress.steps) {
    // One line per kind of step: five queries read as one "querying" line.
    const label = stepLabel(step.tool, tr);
    if (step.status !== "done" || narrator.reportedSteps.has(label)) continue;
    narrator.reportedSteps.add(label);
    appendNarration(send, narrator, `\n${label}`);
  }
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
 * authenticate once, up front. */
export async function connectToHarness(
  session: Session
): Promise<HarnessConnection> {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved)
    return { ok: false, errorMessage: "tenant_unresolved" };

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token = session.user?.rawJWT ?? session.user?.ticket ?? undefined;
  const userEmail = session.user?.email;

  const client = createMiotHarnessClient({
    baseUrl: `${modulithHost()}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: userEmail ? { "X-Dev-User-Email": userEmail } : {},
  });

  return { ok: true, client, orgSlug, token, userEmail };
}

/** How the harness event stream ended. `completed` and `failed` mirror the
 * two terminal events; `truncated` is the stream running dry without either
 * one — an upstream disconnect, not a finished run. */
type RunOutcome = "completed" | "failed" | "truncated";

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
  const line = seatNarration(event);
  if (line) appendNarration(send, narrator, line);
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

async function relayHarnessEvents(
  client: HarnessClient,
  runId: string,
  signal: AbortSignal,
  send: Sender,
  narrator: Narrator,
  tr: TrFn
): Promise<{ tools: string[]; outcome: RunOutcome }> {
  let progress: HarnessStreamProgress = INITIAL_PROGRESS;
  const tools: string[] = [];
  let outcome: RunOutcome = "truncated";

  for await (const event of client.runs.stream(runId, { signal })) {
    if (event.type === "tool.started" && typeof event.data.tool === "string") {
      tools.push(event.data.tool);
    }
    if (FORWARDED_EVENTS.has(event.type)) {
      progress = reduceHarnessStreamEvent(progress, {
        event: event.type,
        data: event.data,
      });
      narrateForwardedEvent(send, narrator, progress, event, tr);
    }
    if (TERMINAL_EVENT_TYPES.has(event.type)) {
      outcome = event.type === "run.failed" ? "failed" : "completed";
      break;
    }
  }

  return { tools, outcome };
}

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
}): Promise<RelayedRun> {
  const { client, harnessRunId, runId, threadId, signal, send, tr } = args;
  sendRunMarker(send, { runId: harnessRunId, status: "running" });

  const narrator = openNarration(send);
  appendNarrationDiff(send, narrator, INITIAL_PROGRESS, tr);
  const { tools, outcome } = await relayHarnessEvents(
    client,
    harnessRunId,
    signal,
    send,
    narrator,
    tr
  );
  closeNarration(send, narrator);

  // A failed run and a stream that died mid-flight both arrive here with no
  // answer to present. RUN_ERROR is terminal on its own, so no RUN_FINISHED
  // follows it. A truncated stream may have left the run alive, so the
  // browser keeps it as the thread's active run and re-attaches on reload.
  if (outcome !== "completed") {
    logger.error(
      { runId: harnessRunId, outcome },
      "[harness/chat/stream] run did not complete"
    );
    if (outcome === "failed") {
      sendRunMarker(send, { runId: harnessRunId, status: "finished" });
    }
    send({
      type: "RUN_ERROR",
      message: outcome === "failed" ? "run_failed" : "stream_truncated",
    });
    return { completed: false };
  }

  const record = await client.runs.get(harnessRunId, { signal });
  for (const event of chatAnswerEvents(record.answer, record.events, {
    noAnswer: tr("harnessChat.stream.noAnswer"),
    assumptionLabel: tr("harnessChat.stream.assumption"),
  })) {
    send(event);
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
  return { completed: true, tools, record };
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
