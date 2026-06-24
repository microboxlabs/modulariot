"use client";

import { useState, useEffect } from "react";
import { BsStars } from "react-icons/bs";
import type { SpotlightItem } from "./types";
import type { HarnessSearchResult } from "@/app/api/harness/search/route";

const DEBOUNCE_MS = 500;

export interface UseHarnessSearchReturn {
  results: SpotlightItem[];
  isLoading: boolean;
}

/**
 * Debounced harness search hook.
 *
 * Fires DEBOUNCE_MS after the user stops typing. Cancels the in-flight request
 * via AbortController whenever the query changes or the component unmounts.
 *
 * The BFF route at /api/harness/search handles auth (user JWT) and communicates
 * with the Quarkus gateway (MIOT_HARNESS_URL env var). Returns empty results
 * gracefully when the env var is not set.
 */
export function useHarnessSearch(query: string): UseHarnessSearchReturn {
  const [results, setResults] = useState<SpotlightItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
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
          setResults(
            data.results.map((r) => ({
              id: r.id,
              label: r.label,
              sublabel: r.sublabel,
              kind: "harness" as const,
              icon: BsStars,
              keywords: [],
              onSelect: () => {},
            })),
          );
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
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setIsLoading(false);
    };
  }, [query]);

  return { results, isLoading };
}
