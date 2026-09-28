"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { RunSummary } from "@microboxlabs/miot-harness-client";
import { RUN_MARKER_WINDOW_EVENT } from "../harness-active-run";

export const ACTIVITY_POLL_MS = 5_000;

export const ACTIVITY_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/chat/runs?limit=20`;

export function isRunning(run: RunSummary): boolean {
  return run.status === "running";
}

/** Runs that were running in `prev` and have ended in `next`. */
export function newlyFinished(
  prev: RunSummary[] | undefined,
  next: RunSummary[]
): RunSummary[] {
  if (!prev) return [];
  const wasRunning = new Set(prev.filter(isRunning).map((run) => run.run_id));
  return next.filter((run) => wasRunning.has(run.run_id) && !isRunning(run));
}

async function fetchRuns(url: string): Promise<RunSummary[]> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`activity_${res.status}`);
  return (await res.json()) as RunSummary[];
}

export interface HarnessActivity {
  runs: RunSummary[];
  runningCount: number;
  failed: boolean;
}

/**
 * The user's running and recent harness runs. Polls while the panel is open
 * or something is running, and refreshes at once when a thread in this
 * browser starts or ends a run. `onFinished` gets each run seen running
 * before and ended now.
 */
export function useHarnessActivity({
  panelOpen,
  onFinished,
}: {
  panelOpen: boolean;
  onFinished: (run: RunSummary) => void;
}): HarnessActivity {
  const { data, error, mutate } = useSWR<RunSummary[]>(
    ACTIVITY_URL,
    fetchRuns,
    {
      refreshInterval: (latest) =>
        panelOpen || latest?.some(isRunning) ? ACTIVITY_POLL_MS : 0,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    const refresh = () => void mutate();
    window.addEventListener(RUN_MARKER_WINDOW_EVENT, refresh);
    return () => window.removeEventListener(RUN_MARKER_WINDOW_EVENT, refresh);
  }, [mutate]);

  useEffect(() => {
    if (panelOpen) void mutate();
  }, [panelOpen, mutate]);

  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);
  const previous = useRef<RunSummary[] | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const done = newlyFinished(previous.current, data);
    previous.current = data;
    for (const run of done) onFinishedRef.current(run);
  }, [data]);

  const runs = data ?? [];
  return {
    runs,
    runningCount: runs.filter(isRunning).length,
    failed: Boolean(error) && !data,
  };
}
