"use client";

import useSWR from "swr";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";

async function fetchTreatment(
  url: string
): Promise<TreatmentsGeneralResponseItem> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch treatment data");
  return response.json();
}

export function useTreatmentsGeneral(id?: string) {
  const { data, isLoading, error } = useSWR<
    TreatmentsGeneralResponseItem,
    Error
  >(id ? `/app/api/treatments/general?id=${id}` : null, fetchTreatment);
  return {
    treatmentData: data ?? null,
    loading: isLoading,
    error: error ?? null,
  };
}
