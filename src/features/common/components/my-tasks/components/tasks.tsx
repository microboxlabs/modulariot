"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import GridTable from "../../grid-table/grid-table";
import TaskListElement from "./task-element";
import { Spinner } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";
import { useEffect, useRef } from "react";

import { KanbanBoardTask } from "@/features/shipping/types/common.types";

export default function TaskList({
  setSelectedTask,
  dict,
  tasks,
  isLoading = false,
  hasMore = true,
  loadMore,
}: {
  setSelectedTask: (taskId: string | null) => void;
  dict: I18nRecord;
  tasks: KanbanBoardTask[];
  isLoading?: boolean;
  hasMore?: boolean;
  loadMore?: () => Promise<void>;
}) {
  const lastElementRef = useRef<HTMLDivElement>(null);
  const hasLoggedRef = useRef(false);

  const mintralIcuConditionImportance = (icuCode = 0) => {
    if (icuCode > 4) {
      return 0;
    }
    return icuCode;
  };

  const sortingTaskRelevance = (
    elem1: KanbanBoardTask,
    elem2: KanbanBoardTask
  ) => {
    return (
      mintralIcuConditionImportance(elem2.mintral_icuCondition) -
      mintralIcuConditionImportance(elem1.mintral_icuCondition)
    );
  };

  const header = [
    tr("my_tasks.stage", dict),
    tr("my_tasks.duration", dict),
    tr("my_tasks.license_plate", dict),
    tr("my_tasks.route", dict),
    tr("my_tasks.client", dict),
    "",
  ];

  // Reset the logged flag when tasks change
  useEffect(() => {
    hasLoggedRef.current = false;
  }, [tasks]);

  // Intersection observer to detect when last element is visible and load more
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            !hasLoggedRef.current &&
            hasMore &&
            !isLoading &&
            loadMore
          ) {
            hasLoggedRef.current = true;
            loadMore();
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
      }
    );

    if (lastElementRef.current) {
      observer.observe(lastElementRef.current);
    }

    return () => {
      if (lastElementRef.current) {
        observer.unobserve(lastElementRef.current);
      }
    };
  }, [tasks, hasMore, isLoading, loadMore]);

  return (
    <div className="w-full h-fit relative">
      <div className="flex flex-col md:hidden w-full gap-2">
        {tasks.sort(sortingTaskRelevance).map((task, index) => (
          <TaskListElement
            key={task.id}
            task={task}
            dict={dict}
            setSelectedTask={setSelectedTask}
            minimized={true}
            ref={index === tasks.length - 1 ? lastElementRef : null}
          />
        ))}
      </div>
      <div className="hidden md:block">
        <GridTable
          header={header}
          content={tasks.map((task, index) => (
            <TaskListElement
              key={task.id}
              task={task}
              dict={dict}
              setSelectedTask={setSelectedTask}
              minimized={false}
              ref={index === tasks.length - 1 ? lastElementRef : null}
            />
          ))}
          style={{
            gridTemplateColumns: "4fr 1fr 1fr 1fr 1fr 1fr",
            minWidth: "600px",
          }}
        />
      </div>
      {hasMore && (
        <div className="flex justify-center pt-4 pb-2">
          <Spinner size="lg" />
        </div>
      )}
      {!hasMore && tasks.length > 0 && (
        <div className="flex justify-center pt-4 pb-2 text-gray-500 text-sm">
          {tr("my_tasks.no_more_tasks_to_load", dict)}
        </div>
      )}
    </div>
  );
}
