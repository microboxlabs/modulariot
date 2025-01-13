import { Badge, Table } from "flowbite-react";
import { KanbanBoardTask } from "../../types/common.types";
import Link from "next/link";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { HiCheck, HiClock } from "react-icons/hi";
import DepartureDateShip from "../departure-date-ship/departure-date-ship";
import Validations from "@/features/task-forms/components/validations/validations";

interface TableViewProps {
  data: KanbanBoardTask[];
  dict: I18nRecord;
}

export function TableView({ data, dict }: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <Table striped>
        <Table.Head>
          <Table.HeadCell>{dict.table?.service || "Service"}</Table.HeadCell>
          <Table.HeadCell>
            {dict.table?.departureDateTime || "Date and time departure"}
          </Table.HeadCell>
          <Table.HeadCell>
            {dict.table?.serviceKind || "Service Kind"}
          </Table.HeadCell>
          <Table.HeadCell>
            {dict.table?.validations || "Validations"}
          </Table.HeadCell>
          <Table.HeadCell>{dict.table?.stage || "Stage"}</Table.HeadCell>
          <Table.HeadCell>{dict.table?.status || "Status"}</Table.HeadCell>
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
              <Table.Cell>
                {/* <div className="flex flex-wrap gap-2">
                  <Badge icon={HiCheck} />
                  <Badge color="gray" icon={HiCheck} />
                  <Badge size="sm" icon={HiCheck} />
                </div> */}
                <Validations task={task} lang={lang} dict={dict} />
              </Table.Cell>
              <Table.Cell>{task.attachment}</Table.Cell>
              <Table.Cell>
                {/* <span
                  className={`px-2 py-1 rounded-full text-xs ${task.completed
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                    }`}
                >
                  {task.completed
                    ? dict.table?.completed || "Completed"
                    : dict.table?.active || "Active"}
                </span> */}
                <DepartureDateShip date={task.expectedDepartureDate ?? ""} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
