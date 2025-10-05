"use client";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState, useMemo } from "react";
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
import ModalTooltip from "../../../shipping/components/modal-tooltip";
//import { useSearchParams } from "next/navigation";

export default function MyTasks({
  dict,
  status,
  userGroups,
  lang,
}: {
  dict: I18nRecord;
  status: string;
  userGroups: string[];
  lang: string;
}) {
  const searchParams = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const filters = useMemo(() => {
    return searchParams
      .toString()
      .split("&")
      .filter(
        (filter) =>
          !filter.includes("titleLabel") && !filter.includes("position")
      )
      .join("&");
  }, [searchParams]);

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
    filters:
      filters.toString() +
      "&editable=true&orderBy=mintral_icuCondition&order=desc",
    status,
  });

  const filterKey = useMemo(() => `${filters}-${status}`, [filters, status]);

  const { visibleTasks, isLoading, hasMore, error, scrollRef, loadMore } =
    useInfiniteScroll({
      fetchData,
      visibleItems: 10,
      filterKey, // Pass filters and status as key to detect changes
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
        <TaskList
          dict={dict}
          tasks={searchTasks}
          setSelectedTask={setSelectedTask}
        />
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
        setSelectedTask={setSelectedTask}
        tasks={visibleTasks}
        isLoading={isLoading}
        hasMore={hasMore}
        loadMore={loadMore}
      />
      {/* Modal Tooltip Component */}
      <ModalTooltip
        lang={lang}
        userGroups={userGroups}
        selectedTask={selectedTask}
        setSelectedTask={setSelectedTask}
        dict={dict as I18nRecord}
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
