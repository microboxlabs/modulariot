import { NextResponse } from "next/server";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { toSearchResult } from "../search-blocks";
import { recordEpisode } from "../../../interactions/episodes/record-episode";

/**
 * Streaming twin of the buffered POST /api/harness/search.
 *
 * Creates a harness run through the modulith proxy (same auth + org-scope
 * chain as the buffered route) and relays the run's SSE events to the
 * browser as they arrive, so the spotlight can narrate what the harness is
 * doing (route chosen, tools running, thinking) instead of waiting silently
 * for the ~35-45s agentic run.
 *
 * Emitted frames (SSE `event:` names):
 * - `search.accepted`  — `{ run_id }`, sent as soon as the run is created.
 * - forwarded harness events (whitelist below) — payload is the event's own
 *   `data` object (flat: `{tool}`, `{route}`, `{delta}` …); the envelope's
 *   `type`/`seq` already travel on the SSE `event:`/`id:` lines and the rest
 *   is unused by the UI, so every frame carries one uniform payload shape.
 * - `search.result`    — `{ results: HarnessSearchResult[] }`, the same
 *   shape the buffered route returns, emitted after the terminal event.
 * - `search.error`     — `{ error: string }` when the relay fails mid-run.
 */

const MIOT_HARNESS_HOST = process.env.MIOT_HARNESS_URL ?? "";

/** Typical agentic runs measure ~35-45s, but harder questions (per-entity
 * detail, not a count) replan several times on the Opus planner and can exceed 2
 * minutes — the run is otherwise cancelled mid-loop and surfaces as a retry
 * error. This raised ceiling is a STOPGAP; the real fix is the harness
 * agent-orchestration redesign (move planning off the every-turn Opus seat to an
 * advisor/orchestrator pattern). The stream is still aborted if the harness never
 * terminates. */
const HARNESS_STREAM_TIMEOUT_MS = 180_000;

/** Chain-of-thought events the browser needs. `answer.delta` is excluded on
 * purpose — with answer_format=json the deltas are fragments of a raw JSON
 * array, useless to render — and `usage.recorded` stays server-side (cost
 * telemetry is not a UI concern). */
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

// TextEncoder is stateless — one instance serves every frame of every request.
const SSE_ENCODER = new TextEncoder();

function sseFrame(event: string, data: unknown, id?: string | number): Uint8Array {
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return SSE_ENCODER.encode(
    `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(request: Request) {
  if (!MIOT_HARNESS_HOST) {
    return NextResponse.json({ error: "harness_unconfigured" }, { status: 503 });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: { query?: string } = await request.json().catch(() => ({}));
  const query = body.query?.trim() ?? "";
  if (!query) return NextResponse.json({ error: "empty_query" }, { status: 400 });

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const orgSlug = scopeResult.scope.activeOrg.slug;

  const token =
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;
  const userEmail = authResult.session.user?.email;

  const client = createMiotHarnessClient({
    baseUrl: `${MIOT_HARNESS_HOST}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: userEmail ? { "X-Dev-User-Email": userEmail } : {},
  });

  let activeRunId: string | null = null;
  let runSettled = false;

  /** Best-effort server-side cancel: when the relay stops before the run is
   * terminal (spotlight dismissed, navigation, 90s cap), tell the harness to
   * stop burning model tokens on an answer nobody will read. Runs on its own
   * timeout signal — the request's controller is already aborted by then. */
  const cancelUpstreamRun = () => {
    if (!activeRunId || runSettled) return;
    runSettled = true;
    client.runs
      .cancel(activeRunId, { signal: AbortSignal.timeout(5_000) })
      .catch(() => {}); // the run may already be terminal — 204 either way
  };

  const controller = new AbortController();
  const abortRelay = () => {
    controller.abort();
    cancelUpstreamRun();
  };
  const timeout = setTimeout(abortRelay, HARNESS_STREAM_TIMEOUT_MS);
  // Browser closed the request (spotlight dismissed, navigation) → stop the
  // upstream relay and cancel the run.
  request.signal.addEventListener("abort", abortRelay);

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      // enqueue() throws once the consumer is gone; treat that as an abort
      // signal rather than an error worth logging.
      const send = (event: string, data: unknown, id?: string | number) => {
        try {
          ctrl.enqueue(sseFrame(event, data, id));
        } catch {
          controller.abort();
        }
      };

      try {
        const { run_id } = await client.runs.create(
          {
            message: query,
            skill_id: "miot-search",
            answer_format: "json",
            mode: "auto",
            ...(userEmail && { user_id: userEmail }),
          },
          { signal: controller.signal },
        );
        activeRunId = run_id;
        send("search.accepted", { run_id });

        // Accumulate the route + tool names as they stream, for the interaction
        // episode written on completion (the learning-loop's captured signal).
        let episodeRoute: string | undefined;
        const episodeTools: string[] = [];

        for await (const event of client.runs.stream(run_id, {
          signal: controller.signal,
        })) {
          if (FORWARDED_EVENTS.has(event.type)) {
            send(event.type, event.data, event.seq);
          }
          if (event.type === "route.selected") {
            const r = (event.data as { route?: unknown }).route;
            if (typeof r === "string") episodeRoute = r;
          } else if (event.type === "tool.started") {
            const t = (event.data as { tool?: unknown }).tool;
            if (typeof t === "string") episodeTools.push(t);
          }
          if (TERMINAL_EVENT_TYPES.has(event.type)) break;
        }

        // Terminal event reached — the run finished on its own; a later
        // disconnect must not fire a pointless cancel.
        runSettled = true;

        // The answer text is only on the final run record, not in the stream.
        const record = await client.runs.get(run_id, { signal: controller.signal });
        send("search.result", {
          results: record.answer ? [toSearchResult(run_id, record.answer)] : [],
          // Ground-or-flag assumptions (with the connection stamped by the
          // harness) so the spotlight can offer an elicit chip → candidate.
          assumptions: record.assumptions ?? [],
        });

        // Fire-and-forget: append the completed search as an interaction episode
        // (query + route/tools + answer + ground-or-flag assumptions) for the
        // semantic-layer learning loop. Best-effort — never blocks or fails the
        // search (recordEpisode swallows its own errors).
        void recordEpisode({
          orgSlug,
          token,
          body: {
            surface: "spotlight",
            runId: run_id,
            payload: {
              query,
              route: episodeRoute,
              tools: episodeTools,
              answer: record.answer,
              assumptions: record.assumptions ?? [],
            },
          },
        });
      } catch (err: unknown) {
        const isAbort =
          controller.signal.aborted || (err as { name?: string }).name === "AbortError";
        if (!isAbort) {
          logger.error({ err }, "[harness/search/stream] relay failed");
          // The relay can no longer observe the run — stop it server-side
          // too; nobody will consume its answer.
          cancelUpstreamRun();
          send("search.error", { error: "stream_failed" });
        }
      } finally {
        clearTimeout(timeout);
        try {
          ctrl.close();
        } catch {
          // already closed/errored — nothing to release
        }
      }
    },
    cancel() {
      abortRelay();
      clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defeat proxy buffering (nginx) so frames flush as they are enqueued.
      "X-Accel-Buffering": "no",
    },
  });
}
