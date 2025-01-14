import { Table } from "flowbite-react";
import { KanbanBoardTask } from "../../types/common.types";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import { tr } from "@/features/i18n/tr.service";

interface TableViewProps {
  data: KanbanBoardTask[];
  dict: I18nRecord;
  lang: string;
}

export function TableView({ data, dict }: TableViewProps) {
  return (
    <div className="overflow-x-auto p-4 bg-white">
      <Table striped>
        <Table.Head>
          <Table.HeadCell>{tr("table.service", dict)}</Table.HeadCell>
          <Table.HeadCell>{tr("table.departureDateTime", dict)}</Table.HeadCell>
          <Table.HeadCell>{tr("table.serviceKind", dict)}</Table.HeadCell>
          <Table.HeadCell>{tr("table.stage", dict)}</Table.HeadCell>
          <Table.HeadCell>{tr("table.status", dict)}</Table.HeadCell>
        </Table.Head>
        <Table.Body>
          {data.map((task) => (
            <Table.Row
              key={task.id}
              className="bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <Table.Cell className="font-medium text-gray-900 dark:text-white cursor-pointer">
                <Link href={`/task/edit/${task.id}`}>{task.name}</Link>
              </Table.Cell>
              <Table.Cell>
                {task.expectedDepartureDate
                  ? new Date(task.expectedDepartureDate).toLocaleString()
                  : "-"}
              </Table.Cell>
              <Table.Cell>{task.serviceKind}</Table.Cell>
              <Table.Cell>{tr(`kanban.${task.title}`, dict)}</Table.Cell>
              <Table.Cell>
                <div className="w-fit">
                  <DepartureDateShip date={task.expectedDepartureDate ?? ""} />
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
