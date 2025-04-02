import { Spinner, Table } from "flowbite-react";
import { KanbanBoardTask } from "../../types/common.types";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import { tr } from "@/features/i18n/tr.service";

interface TableViewProps {
  data: KanbanBoardTask[];
  dict: I18nRecord;
  lang: string;
  set_page: (page: number) => void;
  page: number;
  pageSize: number;
  data_length: number | undefined;
}

export function TableView({ data, dict }: TableViewProps) {
  if (data.length > 0) {
    return (
      <div className="overflow-x-auto bg-white dark:bg-gray-900 dark:text-white h-full flex flex-col border-2 border-gray-200 rounded-lg">
        <Table striped>
          <Table.Head>
            <Table.HeadCell>{tr("table.service", dict)}</Table.HeadCell>
            <Table.HeadCell>
              {tr("table.departureDateTime", dict)}
            </Table.HeadCell>
            <Table.HeadCell>{tr("table.serviceKind", dict)}</Table.HeadCell>
            <Table.HeadCell>{tr("table.stage", dict)}</Table.HeadCell>
            <Table.HeadCell>{tr("table.status", dict)}</Table.HeadCell>
          </Table.Head>
          <Table.Body>
            {data.map((task) => {
              return (
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
                      <DepartureDateShip
                        dict={dict}
                        table_name={task.title ?? ""}
                        date={
                          (task?.arrivalDate as string) ??
                          (task?.estimatedArrivalDate as string) ??
                          ""
                        }
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner aria-label="Default status example" />
      </div>
    );
  }
}
