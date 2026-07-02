"use client";

import { useState, useEffect } from "react";
import { BsStars } from "react-icons/bs";
import type { SpotlightItem } from "./types";
import type { HarnessSearchResult } from "@/app/api/harness/search/route";

function toSpotlightItem(r: HarnessSearchResult): SpotlightItem {
  return {
    id: r.id,
    label: r.label,
    sublabel: r.sublabel,
    blocks: r.blocks,
    kind: "harness" as const,
    icon: BsStars,
    keywords: [],
    onSelect: () => {},
  };
}

export interface UseHarnessSearchReturn {
  results: SpotlightItem[];
  isLoading: boolean;
}

/**
 * Manual-trigger harness search hook.
 *
 * Fires immediately when `committedQuery` becomes non-empty (no debounce —
 * the caller controls when to commit). Cancels the in-flight request via
 * AbortController whenever committedQuery changes or the component unmounts.
 */
export function useHarnessSearch(committedQuery: string): UseHarnessSearchReturn {
  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = committedQuery.trim();

    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const doFetch = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (!controller.signal.aborted) setResults([]);
          return;
        }

        const data: { results: HarnessSearchResult[] } = await res.json();

        if (!controller.signal.aborted) {
          setResults(data.results.map(toSpotlightItem));
        }
      } catch (err: unknown) {
        if (
          (err as { name?: string }).name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    doFetch();

    return () => {
      controller.abort();
      setIsLoading(false);
    };
  }, [committedQuery]);

  return { results, isLoading };
}
