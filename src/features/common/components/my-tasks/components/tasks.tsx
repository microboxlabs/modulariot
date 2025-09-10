"use client";

import CustomTable from "../../custom-table/custom-table";
import TableElement from "./table-element";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function TaskList({ dict }: { dict: I18nRecord }) {
  const header = ["Etapa", "Duración", "Patente", "Ruta", "Cliente"];

  const content = [
    <TableElement key="dato-1" />,
    <TableElement key="dato-2" />,
    <TableElement key="dato-3" />,
    <TableElement key="dato-4" />,
    <TableElement key="dato-5" />,
    <TableElement key="dato-6" />,
    <TableElement key="dato-7" />,
    <TableElement key="dato-8" />,
    <TableElement key="dato-9" />,
    <TableElement key="dato-10" />,
    <TableElement key="dato-11" />,
    <TableElement key="dato-12" />,
    <TableElement key="dato-13" />,
    <TableElement key="dato-14" />,
    <TableElement key="dato-15" />,
    <TableElement key="dato-16" />,
  ];

  return (
    <div className="flex-grow flex flex-col gap-2 overflow-hidden">
      <div className="h-10 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full border border-gray-300 dark:border-gray-600 flex overflow-y-hidden flex-grow min-h-0 ">
        <CustomTable
          content={content}
          header={header}
          hoverable={true}
          style={{ headClassName: "!bg-transparent", bodyClassName: "my-2" }}
          isLoading={false}
        />
      </div>
    </div>
  );
}
