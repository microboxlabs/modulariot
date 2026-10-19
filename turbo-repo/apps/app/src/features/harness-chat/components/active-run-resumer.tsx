"use client";

import { useAuiState, type AssistantRuntime } from "@assistant-ui/react";
import { useEffect, useState, type FC } from "react";
import type { HarnessHistoryAdapter } from "../harness-history-adapter";
import type { HarnessRunAgent } from "../harness-run-agent";

/**
 * Re-attaches a thread to the harness run it was waiting on: after a reload,
 * once its transcript is in, and after a stream that went silent while the
 * run may still have an answer. The run shows as running and its answer is
 * rebuilt from the start.
 */
export const ActiveRunResumer: FC<{
  runtime: AssistantRuntime;
  history: HarnessHistoryAdapter;
  agent: HarnessRunAgent;
}> = ({ runtime, history, agent }) => {
  const isLoading = useAuiState((s) => s.thread.isLoading);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const [lost, setLost] = useState<string | null>(null);

  useEffect(() => {
    agent.onReattach = setLost;
    return () => {
      agent.onReattach = null;
    };
  }, [agent]);

  useEffect(() => {
    if (isLoading) return;
    const runId = history.takePendingResume();
    if (!runId) return;
    agent.resumeRunId = runId;
    const headId = runtime.thread.getState().messages.at(-1)?.id ?? null;
    runtime.thread.startRun({ parentId: headId });
  }, [isLoading, history, agent, runtime]);

  useEffect(() => {
    if (!lost || isRunning) return;
    setLost(null);
    agent.resumeRunId = lost;
    // Answers the same question again, in place of the reply that went silent.
    const question = runtime.thread
      .getState()
      .messages.findLast((m) => m.role === "user");
    runtime.thread.startRun({ parentId: question?.id ?? null });
  }, [lost, isRunning, agent, runtime]);

  return null;
};
