import { Table } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLoadTable } from "../hooks/use-load-table";

export default function Loads({
  trip_id,
  dict,
}: {
  trip_id: string;
  dict: I18nRecord;
}) {
  const { data: task_loads, error, isLoading } = useLoadTable(trip_id);

  return (
    <div
      className={`flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300 ${isLoading ? "bg-gray-300 dark:bg-gray-600 animate-pulse" : "animate-none"}`}
    >
      {!isLoading &&
        task_loads &&
        !error &&
        (task_loads?.mensaje || task_loads?.carga_json?.length === 0 ? (
          <div className="flex justify-center items-center h-full w-full text-gray-500">
            {(dict.kanban as I18nRecord).noLoads as string}
          </div>
        ) : (
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
                {(dict.kanban as I18nRecord).code as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).expeditionNumber as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).length as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).width as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).height as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).volume as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).weight as string}
              </Table.HeadCell>
              <Table.HeadCell className="whitespace-nowrap">
                {(dict.kanban as I18nRecord).loads as string}
              </Table.HeadCell>
            </Table.Head>
            <Table.Body>
              {task_loads?.carga_json?.map((load, index) => (
                <Table.Row key={index}>
                  <Table.Cell className="whitespace-nowrap">
                    {load.expedicion_codigo}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.expedicion_numero}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.largo} m
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.ancho} m
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.alto} m
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.volumen} m3
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.peso} Kg
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {load.bultos}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ))}
      {error && (
        <div className="flex justify-center items-center h-full w-full text-red-500">
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
