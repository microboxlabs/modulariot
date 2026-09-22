"use client";

import useSWR from "swr";

/** Mirrors the harness client's `ModelsInfo` (GET /models). */
export interface HarnessModels {
  default: string | null;
  models: string[];
}

const EMPTY: HarnessModels = { default: null, models: [] };

const fetcher = async (url: string): Promise<HarnessModels> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return (await res.json()) as HarnessModels;
};

/**
 * The conversation models a run may pick, via /api/harness/models (which
 * relays `client.models.list()`). Empty until loaded or when the harness has
 * no per-run model, so the picker stays hidden in both cases.
 */
export function useHarnessModels(): HarnessModels {
  const { data } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/models`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  return data ?? EMPTY;
}
