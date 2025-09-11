import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { Table } from "flowbite-react";
import { FormattedDate } from "../../formatted-date/formatted-date";

export default function TableElement({
  task,
  dict,
}: {
  task: KanbanBoardTask;
  dict: I18nRecord;
}) {
  return (
    <Table.Row className="bg-white dark:bg-gray-800">
      <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
        <div className="flex flex-col text-xl">
          {tr(`myTasks.${task.taskType}`, dict)}
          <div className="flex flex-row gap-4 text-sm font-light">
            <span className="text-gray-500 dark:text-gray-400">
              {task.name}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <FormattedDate date={task.departureDate} format="date" />
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {tr(`myTasks.${task.areaType}`, dict)}
            </span>
          </div>
        </div>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">
          <FormattedDate date={task.duration} format="time" />
        </p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">
          {task.mintral_truckLicensePlate}
        </p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">
          {task.origin}-{task.destination}
        </p>
      </Table.Cell>
      <Table.Cell>
        <p className="text-lg whitespace-nowrap">{task.client}</p>
      </Table.Cell>
    </Table.Row>
  );
}
