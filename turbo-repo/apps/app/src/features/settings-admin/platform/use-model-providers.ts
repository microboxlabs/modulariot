"use client";

import useSWR from "swr";
import {
  deleteModelProvider,
  fetchHarnessPlan,
  fetchModelProviders,
  fetchModelUsage,
  saveHarnessPlan,
  saveModelProvider,
} from "./platform-data-service";
import { ApiError } from "../data/json-client";
import type {
  HarnessPlan,
  ModelProviderAdmin,
  ModelUsageTotal,
  SetHarnessPlan,
  SetModelProvider,
} from "./platform.types";

/** The model providers, and the writes that change them. */
export function useModelProviders() {
  const { data, error, isLoading, mutate } = useSWR<
    ModelProviderAdmin[],
    ApiError
  >("platform-model-providers", fetchModelProviders, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // Setting a default clears it on every other provider, so a save refetches
  // the whole list rather than patching one row.
  const save = async (provider: string, value: SetModelProvider) => {
    const saved = await saveModelProvider(provider, value);
    await mutate();
    return saved;
  };

  const remove = async (provider: string) => {
    await deleteModelProvider(provider);
    await mutate();
  };

  return {
    providers: data ?? [],
    isLoading,
    error: error ?? null,
    save,
    remove,
  };
}

/** Usage totals for one period. */
export function useModelUsage(from: string, to: string) {
  const { data, error, isLoading } = useSWR<ModelUsageTotal[], ApiError>(
    ["platform-model-usage", from, to],
    () => fetchModelUsage(from, to),
    { revalidateOnFocus: false }
  );
  return { totals: data ?? [], isLoading, error: error ?? null };
}

/** The seat plan every organization buys on, and the write that changes it. */
export function useHarnessPlan() {
  const { data, error, isLoading, mutate } = useSWR<HarnessPlan, ApiError>(
    "platform-harness-plan",
    fetchHarnessPlan,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const save = async (value: SetHarnessPlan) => {
    const saved = await saveHarnessPlan(value);
    await mutate(saved, { revalidate: false });
    return saved;
  };

  return { plan: data ?? null, isLoading, error: error ?? null, save };
}
