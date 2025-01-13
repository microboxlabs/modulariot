import { Table } from "flowbite-react";
import { KanbanBoardTask } from "../../types/common.types";
import Link from "next/link";

interface TableViewProps {
  data: KanbanBoardTask[];
}

export function TableView({ data }: TableViewProps) {
  return (
    <div className="overflow-x-auto">
      <Table striped>
        <Table.Head>
          <Table.HeadCell>Service</Table.HeadCell>
          <Table.HeadCell>Origin</Table.HeadCell>
          <Table.HeadCell>Destination</Table.HeadCell>
          <Table.HeadCell>Client</Table.HeadCell>
          <Table.HeadCell>Service Kind</Table.HeadCell>
          <Table.HeadCell>Expected Departure</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
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
              <Table.Cell>{task.origin}</Table.Cell>
              <Table.Cell>{task.destination}</Table.Cell>
              <Table.Cell>{task.client}</Table.Cell>
              <Table.Cell>{task.serviceKind}</Table.Cell>
              <Table.Cell>
                {task.expectedDepartureDate
                  ? new Date(task.expectedDepartureDate).toLocaleString()
                  : "-"}
              </Table.Cell>
              <Table.Cell>
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    task.completed
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {task.completed ? "Completed" : "Active"}
                </span>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
