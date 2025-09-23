"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import GridTable from "../../grid-table/grid-table";
import TaskListElement from "./task-element";
import { Spinner } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";

import { KanbanBoardTask } from "@/features/shipping/types/common.types";

export default function TaskList({
  setSelectedTask,
  dict,
  tasks,
  isLoading = false,
  hasMore = true,
}: {
  setSelectedTask: (taskId: string | null) => void;
  dict: I18nRecord;
  tasks: KanbanBoardTask[];
  isLoading?: boolean;
  hasMore?: boolean;
}) {
  const header = [
    tr("my_tasks.stage", dict),
    tr("my_tasks.duration", dict),
    tr("my_tasks.license_plate", dict),
    tr("my_tasks.route", dict),
    tr("my_tasks.client", dict),
    "",
  ];

  const content = tasks.map((task) => (
    <TaskListElement
      key={task.id}
      task={task}
      dict={dict}
      setSelectedTask={setSelectedTask}
    />
  ));

  return (
    <div className="w-full h-fit relative">
      <GridTable
        header={header}
        content={content}
        style={{
          gridTemplateColumns: "4fr 1fr 1fr 1fr 1fr 1fr",
          minWidth: "600px",
        }}
      />
      {isLoading && hasMore && (
        <div className="flex justify-center pt-4 pb-2">
          <Spinner size="lg" />
        </div>
      )}
      {!hasMore && tasks.length > 0 && (
        <div className="flex justify-center pt-4 pb-2 text-gray-500 text-sm">
          No more tasks to load
        </div>
      )}
    </div>
  );
}
