import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";

export type TaskHistory = {
  activityId: string;
  endTime: string;
  activityType: string;
  assignee: string;
  startTime: string;
};

export function useTaskHistory(taskId: string) {
  const { data, error, isLoading } = useSWR<TaskHistory[], FetcherError>(
    `/app/api/task/history?taskId=${taskId}`,
    fetcher,
  );

  return {
    data,
    error,
    isLoading,
  };
}
