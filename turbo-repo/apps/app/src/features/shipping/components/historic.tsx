import { TaskHistory, useTaskHistory } from "../hooks/use-task-history";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomTable from "@/features/common/components/custom-table/custom-table";

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

  // Ensure taskHistory is always an array
  const safeTaskHistory = Array.isArray(taskHistory) ? taskHistory : [];

  const headers: string[] = [
    (dict.kanban as I18nRecord).taskType as string,
    (dict.kanban as I18nRecord).taskAction as string,
    (dict.kanban as I18nRecord).finalizationDate as string,
    (dict.kanban as I18nRecord).duration as string,
    (dict.kanban as I18nRecord).completedBy as string,
  ];

  let content: string[][] = safeTaskHistory
    .map((item: TaskHistory) => {
      if (item.endTime) {
        const formattedDate = formatDate(item.endTime);

        return [
          ((dict.kanban as I18nRecord)[item.activityId as string] as string) ??
            item.activityName,
          ((dict.kanban as I18nRecord)[item.taskResult as string] as string) ??
            item.taskResult,
          formattedDate,
          get_duration(item.startTime, item.endTime),
          item.assignee ? item.assignee : "-",
        ];
      }
      return undefined;
    })
    .filter((row): row is string[] => row !== undefined);

  return (
    <div className="flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300">
      <CustomTable
        isLoading={isLoading}
        error={error}
        header={headers}
        content={content}
        no_data_message={(dict.kanban as I18nRecord).noLoads as string}
      />
    </div>
  );
}

function get_duration(start: string, end: string) {
  const endTimestamp = new Date(end).getTime();
  const startTimestamp = new Date(start).getTime();
  const duration = endTimestamp - startTimestamp;
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

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const formattedDate = `${date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return formattedDate;
}
