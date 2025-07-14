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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden landscape:hidden">
        <Button className="w-full h-full" color="gray">
          <div className="flex flex-row gap-2 items-center">
            <FaMapPin />
            Abrir mapa
          </div>
        </Button>
      </div>
      <div className="h-1/3 w-full overflow-hidden flex flex-col portrait:h-full">
        
        {/* Mobile selector */}
        <HistoricLoads
          task={task}
          dictionary={dictionary}
          active={active}
        />
        
      </div>
    </div>
  );
}
