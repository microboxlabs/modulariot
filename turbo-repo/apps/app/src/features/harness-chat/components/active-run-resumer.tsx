"use client";

import { useAuiState, type AssistantRuntime } from "@assistant-ui/react";
import { useEffect, type FC } from "react";
import type { HarnessHistoryAdapter } from "../harness-history-adapter";
import type { HarnessRunAgent } from "../harness-run-agent";

/**
 * Re-attaches a reloaded thread to the harness run it was waiting on, once
 * its transcript is in: the run shows as running and its answer is rebuilt
 * from the start.
 */
export const ActiveRunResumer: FC<{
  runtime: AssistantRuntime;
  history: HarnessHistoryAdapter;
  agent: HarnessRunAgent;
}> = ({ runtime, history, agent }) => {
  const isLoading = useAuiState((s) => s.thread.isLoading);

  useEffect(() => {
    if (isLoading) return;
    const runId = history.takePendingResume();
    if (!runId) return;
    agent.resumeRunId = runId;
    const headId = runtime.thread.getState().messages.at(-1)?.id ?? null;
    runtime.thread.startRun({ parentId: headId });
  }, [isLoading, history, agent, runtime]);

  return null;
};
