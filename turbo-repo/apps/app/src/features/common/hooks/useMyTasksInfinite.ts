"use client";
import { useCallback } from "react";
import {
  KanbanBoardTask,
  KanbanBoardTaskResponse,
} from "@/features/shipping/types/common.types";
import fetcher from "../providers/fetcher";
import { SHIPPING_COORDINATOR_PROCESS_TASKS_V2 } from "@/features/task-forms/services/form.service";
import { ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";
import { duration } from "@/utils/time";

interface UseMyTasksInfiniteProps {
  columns: string[];
  showFinished: boolean;
  filters: string;
  status: string;
}

export function useMyTasksInfinite({
  columns,
  showFinished,
  filters,
  status,
}: UseMyTasksInfiniteProps) {
  const fetchData = useCallback(
    async (page: number, limit: number) => {
      const columnQuery = columns
        .map((column) => `columns=${column}`)
        .join("&");
      const from = (page - 1) * limit;
      const paginationQuery = `from=${from}&size=${limit}`;
      const queryString = `${columnQuery}&${paginationQuery}&showFinished=${showFinished}&${filters}`;

      const response = await fetcher<KanbanBoardTaskResponse>(
        `/app/api/task/mytasks?${queryString}`
      );

      if (!response) {
        throw new Error("No data received");
      }

      // Process the data similar to the original component
      const tasks = Object.values(response.data ?? {})
        .map((taskObject) =>
          taskObject.tasks
            .filter((task) => (showFinished ? true : task.isEditable))
            .map((task) => ({
              ...task,
              duration: duration(task),
              taskType: taskObject.id,
              areaType:
                SHIPPING_COORDINATOR_PROCESS_TASKS_V2.indexOf(
                  taskObject.id as unknown as ShippingCoordinatorProcessTaskV2
                ) !== -1
                  ? "shipping"
                  : "delivery",
            }))
        )
        .flat() as unknown as KanbanBoardTask[];

      return {
        data: tasks,
        total: response.total,
        hasMore: page * limit < response.total,
      };
    },
    [columns, showFinished, filters, status]
  );

  return { fetchData };
}
