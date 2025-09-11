"use client";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useMyTasks } from "../../providers/client-api.provider";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";
import { duration } from "@/utils/time";
import { useSearchParams } from "next/navigation";

export default function MyTasks({ dict }: { dict: I18nRecord }) {
  //const [isLoading, setIsLoading] = useState(false);
  //const hoverTimeoutRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const pageSize = 100;
  const columns =
    status === "pending"
      ? [
          ...SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
          ...DELIVERY_COORDINATOR_PROCESS_TASKS,
        ]
      : [...SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS];

  const {
    data: myTasksData,
    error: myTasksError,
    isLoading: isLoading,
  } = useMyTasks([...columns], status === "finished", 1, pageSize, "");

  const tasks = Object.values(myTasksData?.data ?? {})
    .map((taskObject) =>
      taskObject.tasks
        .filter((task) => task.isEditable)
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
    .flat();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (myTasksError) {
    return <div>Error: {myTasksError.message}</div>;
  }

  return (
    <div className="flex flex-col flex-grow bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-hidden">
      <TaskListTitle />
      <TaskList dict={dict} tasks={tasks as unknown as KanbanBoardTask[]} />
    </div>
  );
}
