"use client";

import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  Pagination,
} from "flowbite-react";
import TableItem from "./components/table-item";

// Condition can be:
// - code black
// - critic
// - warning
// - info

const data = [
  {
    condition: "code black",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "critic",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "treatment",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "stable",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "compromised",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  /*
  {
    condition: "observation",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "remission",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  */
];

export default function SymptomsTable() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Condiciones
      </h1>
      <div className="shadow-md rounded-lg w-full h-fit">
        <Table striped className="w-full">
          <TableHead>
            <TableHeadCell>Condición</TableHeadCell>
            <TableHeadCell>Tiempo Activo</TableHeadCell>
            <TableHeadCell>viaje</TableHeadCell>
            <TableHeadCell>Conductor</TableHeadCell>
            <TableHeadCell>Fecha de salida</TableHeadCell>
            <TableHeadCell>Servicio</TableHeadCell>
            <TableHeadCell>Tipo de alerta</TableHeadCell>
          </TableHead>
          <TableBody className="divide-y">
            {data.map((item) => (
              <TableItem key={item.condition} data={item} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex overflow-x-auto sm:justify-center">
        <Pagination
          currentPage={1}
          totalPages={100}
          onPageChange={() => {
            console.log("ejemplo");
          }}
        />
      </div>
    </div>
  );
}
