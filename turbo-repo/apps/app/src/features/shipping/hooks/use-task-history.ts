import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import { FetcherError } from "@/features/common/providers/fetcher.types";

export type TaskHistory = {
  activityId: string;
  endTime: string;
  activityType: string;
  assignee: string;
  startTime: string;
  taskResult: string;
  activityName: string;
};

export function useTaskHistory(taskId: string, active: boolean = true) {
  const { data, error, isLoading } = useSWR<TaskHistory[], FetcherError>(
    `/app/api/task/history?taskId=${taskId}&active=${active}`,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}
