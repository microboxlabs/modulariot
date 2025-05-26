"use client";

import Geographic from "./geographic";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import Historic from "./historic";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import Loads from "./loads";
import KanbanViewSwitcherIcon from "@/features/svg_components/kanban_view_switcher_icon";
import { HiTruck } from "react-icons/hi";
export function GeographicHistoric({
  task,
  dictionary,
}: {
  task: TaskResponse;
  dictionary: Record<string, string>;
}) {
  const [selected_table, setSelectedTable] = useState<number>(0);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden gap-2">
      <div className="h-1/2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Geographic task={task} dictionary={dictionary} />
      </div>
      <div className="h-1/2 w-full overflow-hidden flex flex-col">
        <div className="flex flex-row w-full">
          <div
            className={`w-1/2 border-l border-t border-gray-200 dark:border-gray-600 font-light text-gray-100 flex gap-2 justify-center align-middle py-1 rounded-tl-lg transition-all duration-300 ${selected_table === 0 ? "bg-blue-600 opacity-100 text-white" : "bg-gray-200 dark:bg-gray-800 opacity-50 cursor-pointer text-gray-800 dark:text-gray-100"}`}
            onClick={() => setSelectedTable(0)}
          >
            <div className="w-4 h-full flex items-center justify-center">
              <KanbanViewSwitcherIcon
                className={`w-4 h-4 flex items-center justify-center ${selected_table === 0 ? "fill-gray-100" : ""}`}
              />
            </div>
            {
              (
                (
                  (dictionary.pages as unknown as I18nRecord)
                    .shipping as I18nRecord
                ).kanban as I18nRecord
              ).kanban_movements as unknown as string
            }
          </div>
          <div className="h-full w-[1px] bg-gray-200 dark:bg-gray-600" />
          <div
            className={`w-1/2 border-r h-full border-t border-gray-200 dark:border-gray-600 font-light  text-gray-100 flex gap-2 justify-center align-middle py-1 rounded-tr-lg transition-all duration-300 ${selected_table === 1 ? "bg-blue-600 opacity-100" : "bg-gray-200 dark:bg-gray-800 opacity-50 cursor-pointer text-gray-800 dark:text-gray-100"}`}
            onClick={() => setSelectedTable(1)}
          >
            <div className="w-4 h-full flex items-center justify-center">
              <HiTruck />
            </div>
            {
              (
                (
                  (dictionary.pages as unknown as I18nRecord)
                    .shipping as I18nRecord
                ).kanban as I18nRecord
              ).load_table as unknown as string
            }
          </div>
        </div>
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-b-lg border-b border-x border-gray-200 dark:border-gray-600 overflow-x-auto">
          {selected_table === 0 ? (
            <Historic
              task_id={task.id as string}
              dict={
                (dictionary.pages as unknown as I18nRecord)
                  .shipping as unknown as I18nRecord
              }
            />
          ) : (
            <Loads
              trip_id={task.mintral_serviceCode as string}
              dict={
                (dictionary.pages as unknown as I18nRecord)
                  .shipping as unknown as I18nRecord
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
