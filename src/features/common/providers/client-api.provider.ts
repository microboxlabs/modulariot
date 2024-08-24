import useSWR from "swr";
import fetcher from "./fetcher";
import { FetcherError } from "./fetcher.types";
import { KanbanBoardTaskResponse } from "@/features/shipping/types/common.types";

export function useI8n(lang: string) {
  const { data, error, isLoading } = useSWR(`/api/i18n/${lang}`, fetcher);
  return {
    dict: data,
    error,
    isLoading,
  };
}

export function useMyTasks() {
  const { data, error, isLoading } = useSWR<
    KanbanBoardTaskResponse,
    FetcherError
  >(`/app/api/task/mytasks`, fetcher);
  return {
    data,
    error,
    isLoading,
  };
}
