"use client";

import { useState, useEffect, useMemo } from "react";
import { parseSSE } from "@microboxlabs/miot-harness-client";
import { BsStars } from "react-icons/bs";
import type { SpotlightItem } from "./types";
import type { HarnessSearchResult } from "@/app/api/harness/search/search-blocks";
import {
  INITIAL_PROGRESS,
  reduceHarnessStreamEvent,
  startProgress,
  type HarnessStreamProgress,
} from "./harness-stream";

function toSpotlightItem(r: HarnessSearchResult): SpotlightItem {
  return {
    id: r.id,
    label: r.label,
    sublabel: r.sublabel,
    blocks: r.blocks,
    intent: r.intent,
    kind: "harness" as const,
    icon: BsStars,
    keywords: [],
    onSelect: () => {},
  };
}

export interface UseHarnessSearchReturn {
  results: SpotlightItem[];
  isLoading: boolean;
  /** Live chain-of-thought state driven by the SSE stream. */
  progress: HarnessStreamProgress;
}

const LOADING_PHASES: ReadonlySet<HarnessStreamProgress["phase"]> = new Set([
  "connecting",
  "routing",
  "exploring",
  "verifying",
  "answering",
]);

/**
 * Manual-trigger harness search hook, streaming edition.
 *
 * Fires immediately when `committedQuery` becomes non-empty (no debounce —
 * the caller controls when to commit) and consumes the SSE relay at
 * /api/harness/search/stream, folding each frame through
 * `reduceHarnessStreamEvent` so the spotlight can narrate the run live
 * (route → tools → thinking → answer). Cancels the in-flight stream via
 * AbortController whenever committedQuery changes or the component unmounts.
 */
export function useHarnessSearch(committedQuery: string): UseHarnessSearchReturn {
  const [progress, setProgress] = useState<HarnessStreamProgress>(INITIAL_PROGRESS);

  useEffect(() => {
    const trimmed = committedQuery.trim();

    if (!trimmed) {
      setProgress(INITIAL_PROGRESS);
      return;
    }

    setProgress(startProgress());
    const controller = new AbortController();

    const consumeStream = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/search/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed }),
            signal: controller.signal,
          },
        );

        if (!res.ok || !res.body) {
          if (!controller.signal.aborted) {
            setProgress((prev) => ({ ...prev, phase: "error" }));
          }
          return;
        }

        for await (const frame of parseSSE(res.body)) {
          if (controller.signal.aborted) return;
          let data: unknown;
          try {
            data = frame.data ? JSON.parse(frame.data) : undefined;
          } catch {
            continue; // skip an unparseable frame rather than kill the run
          }
          setProgress((prev) =>
            reduceHarnessStreamEvent(prev, { event: frame.event ?? "", data }),
          );
        }

        // Stream closed without a terminal search.result → surface as error
        // instead of leaving the spinner alive forever.
        if (!controller.signal.aborted) {
          setProgress((prev) =>
            prev.phase === "done" ? prev : { ...prev, phase: "error" },
          );
        }
      } catch (err: unknown) {
        const isAbort =
          controller.signal.aborted || (err as { name?: string }).name === "AbortError";
        if (!isAbort) {
          setProgress((prev) => ({ ...prev, phase: "error" }));
        }
      }
    };

    consumeStream();

    return () => controller.abort();
  }, [committedQuery]);

  const results = useMemo(
    () => (progress.results ?? []).map(toSpotlightItem),
    [progress.results],
  );

  return { results, isLoading: LOADING_PHASES.has(progress.phase), progress };
}
