"use client";
import { useState, useEffect, useRef } from "react";
import { FaArrowUp } from "react-icons/fa"; // install react-icons if not yet
import TaskList from "./components/tasks";
import TaskListTitle from "./components/title/title";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

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

export default function MyTasks({
  dict,
  status,
}: {
  dict: I18nRecord;
  status: string;
}) {
  const searchParams = useSearchParams();

  const [showScroll, setShowScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      setShowScroll(scrollTop > 200);
    };

    container.addEventListener("scroll", handleScroll);

    // Check initial scroll position
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Re-check scroll position when content changes
  useEffect(() => {
    const container = scrollRef.current;
    if (container && myTasksData) {
      // Small delay to ensure content is rendered
      const timeoutId = setTimeout(() => {
        const handleScroll = () => {
          setShowScroll(container.scrollTop > 200);
        };
        handleScroll();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [myTasksData]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

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
      className="flex flex-col bg-white dark:bg-gray-900 p-2 gap-2 overflow-y-auto relative flex-grow h-full max-h-screen"
    >
      <TaskListTitle dict={dict} status={status} searchParams={searchParams} />
      <TaskList dict={dict} tasks={tasks as unknown as KanbanBoardTask[]} />

      {showScroll && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-16 right-6 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 z-50 opacity-90 hover:opacity-100"
          title="Scroll to top"
        >
          <FaArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
