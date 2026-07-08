import { NextResponse } from "next/server";
import {
  createMiotHarnessClient,
  TERMINAL_EVENT_TYPES,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { toSearchResult } from "../search-blocks";

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

/** Same headroom rationale as the buffered route: agentic runs measure
 * ~35-45s; the stream is aborted if the harness never terminates. */
const HARNESS_STREAM_TIMEOUT_MS = 90_000;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HARNESS_STREAM_TIMEOUT_MS);
  // Browser closed the request (spotlight dismissed, navigation) → stop the
  // upstream relay too.
  request.signal.addEventListener("abort", () => controller.abort());

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
        send("search.accepted", { run_id });

        for await (const event of client.runs.stream(run_id, {
          signal: controller.signal,
        })) {
          if (FORWARDED_EVENTS.has(event.type)) {
            send(event.type, event.data, event.seq);
          }
          if (TERMINAL_EVENT_TYPES.has(event.type)) break;
        }

        // The answer text is only on the final run record, not in the stream.
        const record = await client.runs.get(run_id, { signal: controller.signal });
        send("search.result", {
          results: record.answer ? [toSearchResult(run_id, record.answer)] : [],
        });
      } catch (err: unknown) {
        const isAbort =
          controller.signal.aborted || (err as { name?: string }).name === "AbortError";
        if (!isAbort) {
          logger.error({ err }, "[harness/search/stream] relay failed");
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
      controller.abort();
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
