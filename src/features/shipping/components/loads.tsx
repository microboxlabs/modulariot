import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useLoadTable } from "../hooks/use-load-table";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import React from "react";
import { Button } from "flowbite-react";
import Link from "next/dist/client/link";
import { tr } from "@/features/i18n/tr.service";

export default function Loads({
  trip_id,
  msg,
  dict,
}: {
  trip_id: string;
  msg: I18nRecord;
  dict: I18nRecord;
}) {
  const { data: task_loads, error, isLoading } = useLoadTable(trip_id);

  const headers = [
    (dict.kanban as I18nRecord).code as string,
    (dict.kanban as I18nRecord).expeditionNumber as string,
    (dict.kanban as I18nRecord).volume as string,
    (dict.kanban as I18nRecord).weight as string,
    (dict.kanban as I18nRecord).loads as string,
    "",
  ];

  const content: (string[] | React.ReactElement)[] =
    (task_loads?.carga_json?.map((load) => [
      load.expedicion_codigo.toString(),
      load.expedicion_numero.toString(),
      load.volumen + " m3",
      load.peso + " Kg",
      load.bultos.toString(),
      load.expedicion_codigo || load.expedicion_numero ? (
        <Button
          size="md"
          key="goto"
          as={Link}
          href={
            load.expedicion_codigo
              ? `/where-is-my-load?expeditionCode=${load.expedicion_codigo.toString()}`
              : `/where-is-my-load?expeditionNumber=${load.expedicion_numero.toString()}`
          }
          color="blue"
          className="w-fit"
          theme={{
            size: {
              md: "h-5 px-1 text-sm",
            },
          }}
        >
          {tr("wheres_my_load.wheres_my_load", msg)}
        </Button>
      ) : (
        <span>-</span>
      ),
    ]) as (string[] | React.ReactElement)[]) || [];

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
