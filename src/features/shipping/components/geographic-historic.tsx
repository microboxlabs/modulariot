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
      
    </div>
  );
}
