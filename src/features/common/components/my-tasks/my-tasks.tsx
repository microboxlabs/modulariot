"use client";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useEffect, useState } from "react";
import {
  useSearchTasks,
  //  useUserFilters,
} from "../../providers/client-api.provider";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";
import { duration } from "@/utils/time";
import {
  /* usePathname, useRouter,  */ useSearchParams,
} from "next/navigation";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useMyTasksInfinite } from "../../hooks/useMyTasksInfinite";
//import { useSearchParams } from "next/navigation";

export default function MyTasks({
  dict,
  status,
}: {
  dict: I18nRecord;
  status: string;
}) {
  const searchParams = useSearchParams();

  const filters = searchParams
    .toString()
    .split("&")
    .filter(
      (filter) => !filter.includes("titleLabel") && !filter.includes("position")
    )
    .join("&");

  const [hasScrolled, setHasScrolled] = useState(false);

  const columns =
    status === "pending" || status === ""
      ? [
          ...SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
          ...DELIVERY_COORDINATOR_PROCESS_TASKS,
        ]
      : [...SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS];

  const { fetchData } = useMyTasksInfinite({
    columns: [...columns],
    showFinished: status === "finished",
    filters: filters.toString(),
    status,
  });

  const { visibleTasks, isLoading, hasMore, error, scrollRef } =
    useInfiniteScroll({
      fetchData,
      visibleItems: 20,
      stackSize: 30,
      filterKey: `${filters}-${status}`, // Pass filters and status as key to detect changes
    });

  const {
    data: searchTasksData,
    error: searchTasksError,
    isLoading: _isSearchLoading,
  } = useSearchTasks(status === "finished" ? null : searchParams.get("search"));

  /* useEffect(() => {
    console.log("visibleTasks", visibleTasks);
  }, [visibleTasks]); */

  // Handle search results
  if (searchTasksData) {
    const searchTasks = Object.values(searchTasksData.data ?? {})
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
      .flat() as unknown as KanbanBoardTask[];

    return (
      <div className="flex flex-col bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-auto relative h-screen">
        <TaskListTitle
          dict={dict}
          status={status}
          searchParams={searchParams}
        />
        <TaskList dict={dict} tasks={searchTasks} />
      </div>
    );
  }

  if (searchTasksError) {
    return <div>Error: {searchTasksError.message}</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const onScroll = () => {
    if (scrollRef.current) {
      setHasScrolled(scrollRef.current.scrollTop > 0);
    }
  };

  // Optional: scroll to top handler
  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex flex-col bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-auto relative h-screen"
    >
      <TaskListTitle dict={dict} status={status} searchParams={searchParams} />
      <TaskList
        dict={dict}
        tasks={visibleTasks}
        isLoading={isLoading}
        hasMore={hasMore}
      />
      {hasScrolled && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-16 right-6 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 z-10 hover:opacity-100 h-10 w-10 flex items-center justify-center"
          title="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}

/*
  <button
    onClick={scrollToTop}
    className="fixed bottom-16 right-6 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 z-10 opacity-90 hover:opacity-100"
    title="Scroll to top"
  >
    <FaArrowUp className="w-4 h-4" />
  </button>
*/
