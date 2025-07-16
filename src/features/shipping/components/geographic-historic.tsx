"use client";

import Geographic from "./geographic";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { Button } from "flowbite-react";
import { FaMapPin } from "react-icons/fa";
import HistoricLoads from "./historic-loads";

export function GeographicHistoric({
  task,
  dictionary,
  active = true,
}: {
  task: TaskResponse;
  dictionary: Record<string, string>;
  active?: boolean;
}) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden gap-2">
      <div className="h-2/3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden portrait:hidden">
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
                className={`w-4 h-4 flex items-center justify-center ${selected_table === 0 ? "fill-gray-100" : "fill-gray-200"}`}
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
        </div>
      </div>
      <div className="h-1/3 w-full overflow-hidden flex flex-col portrait:h-full">
        {/* Mobile selector */}
        <HistoricLoads task={task} dictionary={dictionary} active={active} />
      </div>
    </div>
  );
}
