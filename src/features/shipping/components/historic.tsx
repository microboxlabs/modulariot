import { Table } from "flowbite-react";
import { TaskHistory, useTaskHistory } from "../hooks/use-task-history";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function Historic({
  task_id,
  dict,
}: {
  task_id: string;
  dict: I18nRecord;
}) {
  const { data: taskHistory } = useTaskHistory(task_id);

  return (
    <div className="flex-1 w-0 min-w-full h-full overflow-x-auto">
      <Table
        hoverable
        striped
        theme={{
          root: {
            base: "w-full text-left text-sm text-gray-500 dark:text-gray-400",
            shadow:
              "absolute left-0 top-0 -z-10 h-full w-full rounded-md bg-white drop-shadow-md dark:bg-black",
            wrapper: "relative",
          },
          body: {
            base: "group/body",
            cell: {
              base: "px-6 py-1",
            },
          },
          head: {
            base: "group/head text-xs uppercase text-gray-700 dark:text-gray-400",
            cell: {
              base: "bg-gray-50 px-6 py-3 dark:bg-gray-600",
            },
          },
          row: {
            base: "group/row",
            hovered: "hover:bg-gray-50 dark:hover:bg-gray-600",
            striped:
              "odd:bg-white even:bg-gray-50 odd:dark:bg-gray-800 even:dark:bg-gray-700",
          },
        }}
      >
        <Table.Head>
          <Table.HeadCell className="whitespace-nowrap">
            {(dict.kanban as I18nRecord).finalizationDate as string}
          </Table.HeadCell>
          <Table.HeadCell className="whitespace-nowrap">
            {(dict.kanban as I18nRecord).duration as string}
          </Table.HeadCell>
          <Table.HeadCell className="whitespace-nowrap">
            {(dict.kanban as I18nRecord).event as string}
          </Table.HeadCell>
          <Table.HeadCell className="whitespace-nowrap">
            {(dict.kanban as I18nRecord).completedBy as string}
          </Table.HeadCell>
          <Table.HeadCell className="whitespace-nowrap">
            {(dict.kanban as I18nRecord).action as string}
          </Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {taskHistory?.map((item: TaskHistory, index) => {
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
                        (duration / (1000 * 60 * 60)) % 24,
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
                  <Table.Cell className="whitespace-nowrap">
                    {
                      (dict.kanban as I18nRecord)[
                        item.activityId as string
                      ] as string
                    }
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap flex justify-center items-center">
                    {item.assignee ? item.assignee : "-"}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {
                      (dict.kanban as I18nRecord)[
                        item.taskResult as string
                      ] as string
                    }
                  </Table.Cell>
                </Table.Row>
              );
            }
          })}
        </Table.Body>
      </Table>
    </div>
  );
}
