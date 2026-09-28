"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";

/**
 * Mirrors the harness client's `ModelsInfo` (GET /models). The modulith adds
 * `multipliers` under a seat plan: how many pool tokens each of a model's
 * tokens uses.
 */
export interface HarnessModels {
  default: string | null;
  models: string[];
  multipliers?: Record<string, number>;
}

export interface HarnessModelsState extends HarnessModels {
  /** "error" when the last fetch failed; the list is then the last good one,
   * possibly from an earlier visit. */
  status: "loading" | "ready" | "error";
  retry: () => void;
}

/** The picker label: the model name, with its multiplier when above 1. */
export function modelLabel(info: HarnessModels, name: string): string {
  const multiplier = info.multipliers?.[name] ?? 1;
  return multiplier > 1 ? `${name} ×${multiplier}` : name;
}

const EMPTY: HarnessModels = { default: null, models: [] };

const STORAGE_KEY = "miot.harnessChat.models";

function readStored(): HarnessModels | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HarnessModels;
    return Array.isArray(parsed.models) ? parsed : null;
  } catch {
    return null;
  }
}

function store(info: HarnessModels): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    // Storage unavailable: the next visit starts without a fallback list.
  }
}

const fetcher = async (url: string): Promise<HarnessModels> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const info = (await res.json()) as HarnessModels;
  store(info);
  return info;
};

/**
 * The conversation models a run may pick, via /api/harness/models (which
 * relays `client.models.list()`). A failed fetch is retried with backoff and
 * keeps the last good list, from this visit or a stored earlier one.
 */
export function useHarnessModels(): HarnessModelsState {
  const [stored, setStored] = useState<HarnessModels | null>(null);
  useEffect(() => {
    setStored(readStored());
  }, []);

  const { data, error, mutate } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/harness/models`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      // SWR doubles the wait after each failure, from this base.
      errorRetryInterval: 2_000,
      errorRetryCount: 5,
    }
  );
  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  let status: HarnessModelsState["status"] = "loading";
  if (error) status = "error";
  else if (data) status = "ready";
  return { ...(data ?? stored ?? EMPTY), status, retry };
}
