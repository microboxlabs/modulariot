import { TaskHistory, useTaskHistory } from "../hooks/use-task-history";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { BaseTimelineEvent } from "@/features/common/components/timeline-event";
import { Spinner } from "flowbite-react";
import { HiArrowRight } from "react-icons/hi";

export default function Historic({
  task_id,
  dict,
  active,
}: {
  task_id: string;
  dict: I18nRecord;
  active: boolean;
}) {
  const {
    data: taskHistory,
    isLoading,
    error,
  } = useTaskHistory(task_id, active);

  const safeTaskHistory = Array.isArray(taskHistory) ? taskHistory : [];

  const completedItems = safeTaskHistory
    .filter((item): item is TaskHistory & { endTime: string } => !!item.endTime)
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-red-500">
        {(dict.kanban as I18nRecord).loadError as string}
      </p>
    );
  }

  if (completedItems.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
        {(dict.kanban as I18nRecord).noLoads as string}
      </p>
    );
  }

  return (
    <div className="flex-1 w-0 min-w-full overflow-y-auto h-full p-4 transition-all duration-300 bg-white dark:bg-gray-800 rounded-b-lg border-t border-gray-200 dark:border-gray-600">
      {completedItems.map((item, index) => {
        const fromLabel =
          ((dict.kanban as I18nRecord)[item.activityId] as string) ??
          item.activityName;
        const toLabel =
          ((dict.kanban as I18nRecord)[item.taskResult] as string) ??
          item.taskResult;

        return (
          <BaseTimelineEvent
            key={`${item.activityId}-${item.endTime}`}
            dotColor="bg-blue-500 dark:bg-blue-400"
            isLast={index === completedItems.length - 1}
          >
            {/* Transition: from → to */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {fromLabel}
              </span>
              <HiArrowRight className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {toLabel}
              </span>
            </div>

            {/* Metadata: assignee + time highlighted */}
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {formatDate(item.endTime)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getDuration(item.startTime, item.endTime)}
              </span>
              {item.assignee && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.assignee}
                </span>
              )}
            </div>
          </BaseTimelineEvent>
        );
      })}
    </div>
  );
}

function getDuration(start: string, end: string): string {
  const duration = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.length > 0 ? parts.join(" ") : "0s";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
