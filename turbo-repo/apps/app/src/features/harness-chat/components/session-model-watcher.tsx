"use client";

import { useAgUiState } from "@assistant-ui/react-ag-ui";
import { useEffect, useRef, type FC } from "react";
import { setThreadModel } from "../harness-thread-store";

/**
 * Stores the model each run used with the thread, so reopening it starts on
 * the same model. The chat route puts it in AG-UI state at the end of a run.
 * Writes go one after another, so a slow earlier write cannot land after a
 * later one and leave the older model stored.
 */
export const SessionModelWatcher: FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useAgUiState() as { harnessModelUsed?: unknown } | undefined;
  const model = state?.harnessModelUsed;
  const persisted = useRef<string | null>(null);
  const lastWrite = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (typeof model !== "string" || !model || model === persisted.current)
      return;
    persisted.current = model;
    lastWrite.current = lastWrite.current
      .catch(() => undefined)
      .then(() => setThreadModel(sessionId, model))
      .then((saved) => {
        if (!saved && persisted.current === model) persisted.current = null;
      });
  }, [sessionId, model]);

  return null;
};
