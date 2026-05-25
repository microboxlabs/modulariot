import { useCallback, useEffect, useReducer, useRef } from "react";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  HarnessEvent,
  HarnessRunRecord,
  UserRequest,
} from "@microboxlabs/miot-harness-client";
import { initialSession, reduce } from "./session/reducer.js";
import { defaultMiotChatHome } from "./persistence/paths.js";
import type {
  ReducerContext,
  SessionAction,
  SessionMetaInit,
  SessionState,
} from "./session/types.js";

const DEBUG_ENV = "MIOT_CHAT_TUI_DEBUG";

function debugEnabled(): boolean {
  return process.env[DEBUG_ENV] === "1";
}

function debugLogPath(): string {
  return `${defaultMiotChatHome()}/last-run.log`;
}

function debugLog(line: Record<string, unknown>): void {
  if (!debugEnabled()) return;
  try {
    const path = debugLogPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      `${JSON.stringify({ ts: new Date().toISOString(), ...line })}\n`,
    );
  } catch {
    // Swallow log errors — debugging shouldn't break the TUI.
  }
}

export interface HarnessClientLike {
  runs: {
    create: (
      body: UserRequest,
      opts?: { signal?: AbortSignal },
    ) => Promise<{ run_id: string }>;
    stream: (
      runId: string,
      opts?: { signal?: AbortSignal; lastEventId?: string },
    ) => AsyncIterable<HarnessEvent>;
    get: (
      runId: string,
      opts?: { signal?: AbortSignal },
    ) => Promise<HarnessRunRecord>;
  };
}

export interface UseSessionOptions {
  initial: SessionMetaInit;
  ctx: ReducerContext;
  client: HarnessClientLike;
}

export interface UseSessionApi {
  state: SessionState;
  dispatch: (action: SessionAction) => void;
  submit: (prompt: string) => Promise<void>;
  abort: () => void;
}

export function useSession(opts: UseSessionOptions): UseSessionApi {
  const [state, dispatch] = useReducer(
    (s: SessionState, a: SessionAction): SessionState => reduce(s, a, opts.ctx),
    null,
    () => initialSession(opts.initial, opts.ctx),
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (prompt: string): Promise<void> => {
      const meta = stateRef.current.meta;
      const trimmed = prompt.trim();
      if (trimmed.length === 0) return;

      debugLog({ event: "submit", prompt, meta });
      dispatch({ kind: "BEGIN_TURN", prompt });

      const controller = new AbortController();
      abortRef.current = controller;

      let runId: string;
      try {
        const created = await opts.client.runs.create(
          {
            message: prompt,
            tenant_id: meta.tenantId,
            user_id: meta.userId,
            mode: meta.mode,
            conversation_id: meta.conversationId,
            ...(meta.debug ? { debug: true } : {}),
          },
          { signal: controller.signal },
        );
        runId = created.run_id;
        debugLog({ event: "create.ok", runId });
      } catch (err) {
        debugLog({
          event: "create.err",
          message: err instanceof Error ? err.message : String(err),
        });
        dispatch({
          kind: "END_TURN",
          failureMessage: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      try {
        for await (const event of opts.client.runs.stream(runId, {
          signal: controller.signal,
        })) {
          debugLog({
            event: "stream.event",
            runId,
            type: event.type,
            seq: event.seq,
            message: event.message,
            data: event.data,
          });
          dispatch({ kind: "STREAM_EVENT", event, runId });
          if (
            event.type === "run.completed" ||
            event.type === "run.failed"
          ) {
            break;
          }
        }
        debugLog({ event: "stream.end", runId });
      } catch (err) {
        debugLog({
          event: "stream.err",
          runId,
          message: err instanceof Error ? err.message : String(err),
        });
        dispatch({
          kind: "END_TURN",
          failureMessage: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      // After the stream ends we fetch the canonical run record so
      // END_TURN can flip the assistant item with the authoritative
      // answer text. The harness's GET /runs/{id} has been observed
      // hanging for some flows; guard with a bounded timeout so the
      // assistant turn always exits "streaming" within a few seconds.
      const recordController = new AbortController();
      const RECORD_TIMEOUT_MS = 8_000;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        recordController.abort();
      }, RECORD_TIMEOUT_MS);
      debugLog({ event: "get.start", runId });
      try {
        const record = await opts.client.runs.get(runId, {
          signal: recordController.signal,
        });
        debugLog({
          event: "get.ok",
          runId,
          answerLength: record.answer?.length ?? null,
          status: record.status,
        });
        dispatch({ kind: "END_TURN", record });
      } catch (err) {
        // Surface a clear, visible failure rather than silently flipping
        // the assistant to an empty "complete" row. The reducer's
        // failureMessage branch flips status to "failed" (red) AND
        // appends a "error: ..." system item, so the user can tell at
        // a glance that the run finished but the answer never landed.
        const detail = timedOut
          ? `run record fetch timed out after ${RECORD_TIMEOUT_MS}ms — check that GET /runs/${runId} returns promptly`
          : err instanceof Error
            ? err.message
            : String(err);
        debugLog({ event: "get.err", runId, timedOut, message: detail });
        dispatch({ kind: "END_TURN", failureMessage: detail });
      } finally {
        clearTimeout(timer);
      }
    },
    [opts.client],
  );

  const abort = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  return { state, dispatch, submit, abort };
}
