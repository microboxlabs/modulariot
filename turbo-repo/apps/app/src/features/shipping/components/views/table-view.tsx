import { Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "flowbite-react";
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
          <TableHead>
            <TableRow>
              <TableHeadCell>{tr("table.service", dict)}</TableHeadCell>
              <TableHeadCell>{tr("table.licensePlate", dict)}</TableHeadCell>
              <TableHeadCell>
                {tr("table.departureDateTime", dict)}
              </TableHeadCell>
              <TableHeadCell className="text-center">
                {tr("table.serviceKind", dict)}
              </TableHeadCell>
              <TableHeadCell className="text-center">
                {tr("table.stage", dict)}
              </TableHeadCell>
              <TableHeadCell className="text-center">
                {tr("table.origin", dict)}-{tr("table.destination", dict)}
              </TableHeadCell>
              <TableHeadCell>{tr("table.status", dict)}</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((task) => {
              return (
                <TableRow
                  key={task.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="font-medium text-gray-900 dark:text-white cursor-pointer">
                    <Link href={`/task/edit/${task.id}`} prefetch={false}>
                      {task.name}
                    </Link>
                  </TableCell>
                  <TableCell>{task.mintral_truckLicensePlate}</TableCell>
                  <TableCell>
                    {task.expectedDepartureDate
                      ? new Date(task.expectedDepartureDate).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {task.serviceKind}
                  </TableCell>
                  <TableCell className="text-center">
                    {tr(`kanban.${task.title}`, dict)}
                  </TableCell>
                  <TableCell className="text-center">
                    {task.origin}-{task.destination}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
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
