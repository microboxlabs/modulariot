"use client";

import Geographic from "./geographic";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import Historic from "./historic";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useState } from "react";
import Loads from "./loads";
import KanbanViewSwitcherIcon from "@/features/svg_components/kanban_view_switcher_icon";
import { HiChevronDown, HiTruck } from "react-icons/hi";
import { Button, Dropdown, DropdownItem } from "flowbite-react";
import { FaMapPin } from "react-icons/fa";
import { CredentialsSignin } from 'next-auth';

export function GeographicHistoric({
  task,
  dictionary,
  active = true,
}: {
  task: TaskResponse;
  dictionary: Record<string, string>;
  active?: boolean;
}) {
  const [selected_table, setSelectedTable] = useState<number>(0);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);

  const selectors = [
    (
      (
        (dictionary.pages as unknown as I18nRecord)
          .shipping as I18nRecord
      ).kanban as I18nRecord
    ).kanban_movements as unknown as string,
    (
      (
        (dictionary.pages as unknown as I18nRecord)
          .shipping as I18nRecord
      ).kanban as I18nRecord
    ).load_table as unknown as string
  ]

  return (
    <div className="h-full w-full flex flex-col overflow-hidden gap-2">
      <div className="h-1/2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden portrait:hidden">
        <Geographic task={task} dictionary={dictionary} />
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden landscape:hidden">
        <Button className="w-full h-full" color="gray">
          <div className="flex flex-row gap-2 items-center">
            <FaMapPin />
            Abrir mapa
          </div>
        </Button>
      </div>
      <div className="h-1/2 w-full overflow-hidden flex flex-col portrait:h-full">
        <div className=" hidden md:flex flex-row w-full">
          <div
            className={`w-1/2 border-l border-t border-gray-200 dark:border-gray-600 font-light text-gray-100 flex gap-2 justify-center align-middle py-1 rounded-tl-lg transition-all duration-300 ${selected_table === 0 ? "bg-blue-600 opacity-100 text-white" : "bg-gray-200 dark:bg-gray-800 opacity-50 cursor-pointer text-gray-800 dark:text-gray-100"}`}
            onClick={() => setSelectedTable(0)}
          >
            <div className="w-4 h-full flex items-center justify-center">
              <KanbanViewSwitcherIcon
                className={`w-4 h-4 flex items-center justify-center ${selected_table === 0 ? "!fill-white" : ""}`}
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
        {/* Mobile selector */}
        
        <div className="landscape:hidden relative select-none cursor-pointer transition-all duration-300 hover:bg-blue-700 dark:hover:bg-blue-700 flex flex-row gap-2 items-center justify-center h-10 w-full bg-blue-600 dark:bg-blue-600 text-white rounded-lg rounded-b-none" onClick={() => setIsSelectorOpen(!isSelectorOpen)}>
          <HiChevronDown className={`w-4 h-4 transition-all duration-300 ${isSelectorOpen ? "rotate-180" : ""}`} />
          {selectors[selected_table]}
          <div className={`${isSelectorOpen ? "max-h-40" : "max-h-0"} transition-all duration-300 w-full text-gray-900 dark:text-gray-100 flex-1 flex flex-col items-center justify-end absolute top-full left-0 bg-white dark:bg-gray-700 z-50 rounded-b-lg overflow-hidden`}>
            {selectors.map((selector, index) => (
              <div key={index} className={`border ${selected_table === index ? " border-blue-600 dark:border-blue-600" : "border-transparent"} w-full h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-500 cursor-pointer transition-all duration-300`} onClick={() => setSelectedTable(index)}>
                {selector}
              </div>
            ))}
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
              active={active}
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
