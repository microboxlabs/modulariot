"use client";

import { useAgUiState } from "@assistant-ui/react-ag-ui";
import { useEffect, useRef, type FC } from "react";
import { setThreadSummary } from "../harness-thread-store";

/**
 * Stores the harness's compacted memory of this conversation with the thread.
 * The chat route puts it in AG-UI state at the end of every run; the history
 * adapter hands it back on load, so a harness that has since restarted gets
 * the part of the conversation its own compaction cleared.
 */
export const SessionSummaryWatcher: FC<{ sessionId: string }> = ({ sessionId }) => {
  const state = useAgUiState() as { harnessConversationSummary?: unknown } | undefined;
  const summary = state?.harnessConversationSummary;
  // What is already stored, including the value the adapter loaded — the
  // state after a run repeats it when nothing was compacted since.
  const persisted = useRef<string | null>(null);

  useEffect(() => {
    if (typeof summary !== "string" || !summary || summary === persisted.current) return;
    persisted.current = summary;
    void setThreadSummary(sessionId, summary).then((saved) => {
      if (!saved && persisted.current === summary) persisted.current = null;
    });
  }, [sessionId, summary]);

  return null;
};
