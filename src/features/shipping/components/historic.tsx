import { Table } from "flowbite-react";
import { TaskHistory, useTaskHistory } from "../hooks/use-task-history";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import CustomTable from "@/features/common/components/table/table";

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

  const headers = [
    (dict.kanban as I18nRecord).taskType as string,
    (dict.kanban as I18nRecord).taskAction as string,
    (dict.kanban as I18nRecord).finalizationDate as string,
    (dict.kanban as I18nRecord).duration as string,
    (dict.kanban as I18nRecord).completedBy as string,
  ];

  return (
    <div className="flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300">
      <CustomTable
        data={safeTaskHistory}
        no_data_message={(dict.kanban as I18nRecord).noLoads as string}
        isLoading={isLoading}
        error={error}
        headers={headers}
        data_count={safeTaskHistory.length}
      >
        {safeTaskHistory.map((item: TaskHistory, index) => {
          if (item.endTime) {
            const date = new Date(item.endTime);
            const formattedDate = `${date.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })} ${date.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}`;

            return (
              <Table.Row key={index}>
                <Table.Cell className="whitespace-nowrap">
                  {((dict.kanban as I18nRecord)[
                    item.activityId as string
                  ] as string) ?? item.activityName}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {((dict.kanban as I18nRecord)[
                    item.taskResult as string
                  ] as string) ?? item.taskResult}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formattedDate}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {(() => {
                    const endTimestamp = new Date(item.endTime).getTime();
                    const startTimestamp = new Date(item.startTime).getTime();
                    const duration = endTimestamp - startTimestamp;
                    const seconds = Math.floor((duration / 1000) % 60);
                    const minutes = Math.floor((duration / (1000 * 60)) % 60);
                    const hours = Math.floor(
                      (duration / (1000 * 60 * 60)) % 24
                    );
                    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
                    const parts = [];
                    if (days > 0) parts.push(`${days}d`);
                    if (hours > 0) parts.push(`${hours}h`);
                    if (minutes > 0) parts.push(`${minutes}m`);
                    if (seconds > 0) parts.push(`${seconds}s`);
                    return parts.length > 0 ? parts.join(" ") : "0s";
                  })()}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap flex justify-center items-center">
                  {item.assignee ? item.assignee : "-"}
                </Table.Cell>
              </Table.Row>
            );
          }
        })}
      </CustomTable>
    </div>
  );
}
