"use client";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  useMyTasks,
  useSearchTasks,
  useUserFilters,
} from "../../providers/client-api.provider";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";
import { duration } from "@/utils/time";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
//import { useSearchParams } from "next/navigation";

export default function MyTasks({
  dict,
  status,
}: {
  dict: I18nRecord;
  status: string;
}) {
  //const [isLoading, setIsLoading] = useState(false);
  //const hoverTimeoutRef = useRef<number | null>(null);
  const router = useRouter();
  const pathName = usePathname();
  const searchParams = useSearchParams();
  const {
    data: userFiltersData,
    error: _userFiltersError,
    isLoading: _userFiltersLoading,
  } = useUserFilters();

  if (userFiltersData && status === "pending") {
    const filters = userFiltersData.split("&");
    const params = new URLSearchParams(searchParams.toString());

    filters.forEach((filter) => {
      const [key, value] = filter.split("=");
      params.set(key, value);
    });
    router.push(`${pathName}?${params.toString()}`);
  }

  const pageSize = 100;
  const columns =
    status === "pending" || status === ""
      ? [
          ...SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
          ...DELIVERY_COORDINATOR_PROCESS_TASKS,
        ]
      : [...SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS];

  let {
    data: myTasksData,
    error: myTasksError,
    isLoading: isLoading,
  } = useMyTasks(
    [...columns],
    status === "finished",
    1,
    pageSize,
    searchParams.toString()
  );

  const {
    data: searchTasksData,
    error: searchTasksError,
    isLoading: _2,
  } = useSearchTasks(status === "finished" ? null : searchParams.get("search"));

  if (searchTasksData) {
    if (myTasksData) myTasksData!.data = searchTasksData.data;
    else
      myTasksData = {
        data: searchTasksData.data,
        total: searchTasksData.total,
      };
  }

  if (searchTasksError) {
    return <div>Error: {searchTasksError.message}</div>;
  }

  const tasks = Object.values(myTasksData?.data ?? {})
    .map((taskObject) =>
      taskObject.tasks
        .filter((task) => (status === "finished" ? true : task.isEditable))
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
      <TaskListTitle dict={dict} status={status} searchParams={searchParams} />
      <TaskList dict={dict} tasks={tasks as unknown as KanbanBoardTask[]} />
    </div>
  );
}
