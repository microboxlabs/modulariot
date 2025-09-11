"use client";

import CustomTable from "../../custom-table/custom-table";
import TableElement from "./table-element";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";

export default function TaskList({
  dict,
  tasks,
}: {
  dict: I18nRecord;
  tasks: KanbanBoardTask[];
}) {
  const header = ["Etapa", "Duración", "Patente", "Ruta", "Cliente"];

  const content = tasks.map((task) => (
    <TableElement key={task.id} task={task} dict={dict} />
  ));
  return (
    <div className="flex-grow flex flex-col gap-2 overflow-hidden">
      <div className="h-10 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full border border-gray-300 dark:border-gray-600 flex overflow-y-hidden flex-grow min-h-0 ">
        <CustomTable
          content={content}
          header={header}
          hoverable={true}
          style={{ headClassName: "!bg-transparent", bodyClassName: "my-2" }}
          isLoading={false}
        />
      </div>
    </div>
  );
}
