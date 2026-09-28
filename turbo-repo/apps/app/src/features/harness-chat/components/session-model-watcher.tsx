"use client";

import { useAgUiState } from "@assistant-ui/react-ag-ui";
import { useEffect, useRef, type FC } from "react";
import { setThreadModel } from "../harness-thread-store";

/**
 * Stores the model each run used with the thread, so reopening it starts on
 * the same model. The chat route puts it in AG-UI state at the end of a run.
 */
export const SessionModelWatcher: FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const state = useAgUiState() as { harnessModelUsed?: unknown } | undefined;
  const model = state?.harnessModelUsed;
  const persisted = useRef<string | null>(null);

  useEffect(() => {
    if (typeof model !== "string" || !model || model === persisted.current)
      return;
    persisted.current = model;
    void setThreadModel(sessionId, model).then((saved) => {
      if (!saved && persisted.current === model) persisted.current = null;
    });
  }, [sessionId, model]);

  return null;
};
