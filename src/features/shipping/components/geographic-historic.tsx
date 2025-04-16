"use client";

import Geographic from "./geographic";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import Historic from "./historic";

export function GeographicHistoric({
  task,
  dictionary,
}: {
  task: TaskResponse;
  dictionary: Record<string, string>;
}) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden gap-2">
      <div className="h-1/2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Geographic task={task} dictionary={dictionary} />
      </div>
      <div className="h-1/2 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <Historic task_id={task.id as string} dict={dictionary} />
      </div>
    </div>
  );
}
