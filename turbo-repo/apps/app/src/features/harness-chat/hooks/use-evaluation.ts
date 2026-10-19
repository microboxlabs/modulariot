"use client";

import useSWR from "swr";
import type { Evaluation } from "../extensions/learning-eval-args";
import { fetchEvaluation } from "../knowledge-api";

const POLL_MS = 2_000;

/** An evaluation, re-read while it runs. */
export function useEvaluation(id: string | null) {
  return useSWR<Evaluation>(
    id ? ["learning-evaluation", id] : null,
    () => fetchEvaluation(id as string),
    {
      revalidateOnFocus: false,
      refreshInterval: (latest) => (latest?.status === "running" ? POLL_MS : 0),
    }
  );
}
