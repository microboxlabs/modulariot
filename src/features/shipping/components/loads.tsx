import { Table } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLoadTable } from "../hooks/use-load-table";
import CustomTable from "@/features/common/components/table/table";

export default function Loads({
  trip_id,
  dict,
}: {
  trip_id: string;
  dict: I18nRecord;
}) {
  const { data: task_loads, error, isLoading } = useLoadTable(trip_id);

  const headers = [
    (dict.kanban as I18nRecord).code as string,
    (dict.kanban as I18nRecord).expeditionNumber as string,
    (dict.kanban as I18nRecord).length as string,
    (dict.kanban as I18nRecord).width as string,
    (dict.kanban as I18nRecord).height as string,
    (dict.kanban as I18nRecord).volume as string,
    (dict.kanban as I18nRecord).weight as string,
    (dict.kanban as I18nRecord).loads as string,
  ];

  return (
    <div className="flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300">
      <CustomTable
        data={task_loads}
        no_data_message={(dict.kanban as I18nRecord).noLoads as string}
        isLoading={isLoading}
        error={error}
        headers={headers}
        data_count={task_loads?.carga_json?.length ?? 0}
      >
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
            <Table.Cell className="whitespace-nowrap">{load.alto} m</Table.Cell>
            <Table.Cell className="whitespace-nowrap">
              {load.volumen} m3
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap">
              {load.peso} Kg
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap">{load.bultos}</Table.Cell>
          </Table.Row>
        ))}
      </CustomTable>
    </div>
  );
}
