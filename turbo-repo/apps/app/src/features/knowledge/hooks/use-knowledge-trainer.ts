"use client";

import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";

/** Whether the signed-in user is a trainer. False while loading or on error. */
export function useKnowledgeTrainer() {
  const { data, isLoading } = useSWR<{ trainer: boolean }>(
    "/app/api/knowledge/trainer",
    fetcher
  );
  return { isTrainer: data?.trainer === true, isLoading };
}
