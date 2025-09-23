"use client";
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useRef, useState } from "react";
import {
  useMyTasks,
  useSearchTasks,
} from "../../providers/client-api.provider";
import {
  DELIVERY_COORDINATOR_PROCESS_TASKS,
  SHIPPING_FINISHED_COORDINATOR_PROCESS_TASKS,
  SHIPPING_COORDINATOR_PROCESS_TASKS_V2,
} from "@/features/task-forms/services/form.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { ShippingCoordinatorProcessTaskV2 } from "@/features/task-forms/services/form.service.types";
import { duration } from "@/utils/time";
import { useSearchParams } from "next/navigation";
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
  //const [isLoading, setIsLoading] = useState(false);
  //const hoverTimeoutRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex flex-col bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-auto relative h-screen"
    >
      <TaskListTitle dict={dict} status={status} searchParams={searchParams} />
      <TaskList
        dict={dict}
        tasks={tasks as unknown as KanbanBoardTask[]}
        setSelectedTask={setSelectedTask}
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

/*
  <button
    onClick={scrollToTop}
    className="fixed bottom-16 right-6 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 z-10 opacity-90 hover:opacity-100"
    title="Scroll to top"
  >
    <FaArrowUp className="w-4 h-4" />
  </button>
*/
