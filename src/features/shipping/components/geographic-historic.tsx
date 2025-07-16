"use client";

import Geographic from "./geographic";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
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
      <div className="h-1/3 w-full overflow-hidden flex flex-col portrait:h-full">
        {/* Mobile selector */}
        <HistoricLoads task={task} dictionary={dictionary} active={active} />
      </div>
    </div>
  );
}
