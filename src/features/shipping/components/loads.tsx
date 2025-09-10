import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLoadTable } from "../hooks/use-load-table";
import CustomTable from "@/features/common/components/custom-table/custom-table";

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

  const content: string[][] =
    task_loads?.carga_json?.map((load) => [
      load.expedicion_codigo.toString(),
      load.expedicion_numero.toString(),
      load.largo + " m",
      load.ancho + " m",
      load.alto + " m",
      load.volumen + " m3",
      load.peso + " Kg",
      load.bultos.toString(),
    ]) || [];

  return (
    <div className="flex-1 w-0 min-w-full overflow-x-auto h-full transition-all duration-300">
      <CustomTable
        content={content || []}
        no_data_message={(dict.kanban as I18nRecord).noLoads as string}
        isLoading={isLoading}
        error={error}
        header={headers}
      />
    </div>
  );
}
