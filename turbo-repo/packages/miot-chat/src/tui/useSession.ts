import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  HarnessEvent,
  HarnessRunRecord,
  UserRequest,
} from "@microboxlabs/miot-harness-client";
import { initialSession, reduce } from "./session/reducer.js";
import type {
  ReducerContext,
  SessionAction,
  SessionMetaInit,
  SessionState,
} from "./session/types.js";

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
    get: (runId: string) => Promise<HarnessRunRecord>;
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
          },
          { signal: controller.signal },
        );
        runId = created.run_id;
      } catch (err) {
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
          dispatch({ kind: "STREAM_EVENT", event, runId });
          if (
            event.type === "run.completed" ||
            event.type === "run.failed"
          ) {
            break;
          }
        }
      } catch (err) {
        dispatch({
          kind: "END_TURN",
          failureMessage: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      try {
        const record = await opts.client.runs.get(runId);
        dispatch({ kind: "END_TURN", record });
      } catch {
        dispatch({ kind: "END_TURN" });
      }
    },
    [opts.client],
  );

  const abort = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  return { state, dispatch, submit, abort };
}
