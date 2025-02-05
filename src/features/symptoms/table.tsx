"use client";

import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  Pagination,
  Button,
  TextInput,
  Label,
} from "flowbite-react";
import TableItem from "./components/table-item";
import { HiSearch } from "react-icons/hi";
import { FiMaximize } from "react-icons/fi";
import { FaFilter } from "react-icons/fa";
import { FaArrowsRotate } from "react-icons/fa6";
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

export default function SymptomsTable({
  setShowCards,
  showCards,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
}) {
  return (
    <div className="p-5 flex flex-col gap-4 w-full">
      <div className="flex flex-row justify-between w-full text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Condiciones
        <div className="flex flex-row gap-2 h-full">
          <div
            className={`flex flex-row gap-2 h-full overflow-hidden transition-all duration-300 
              ${!showCards ? "max-w-[1000px]" : "max-w-0"}
            `}
          >
            <form className="hidden lg:block">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <TextInput
                className="w-full "
                icon={HiSearch}
                id="search"
                name="search"
                placeholder="Search"
                type="search"
              />
            </form>
            <Button
              className="justify-self-end flex justify-center items-center h-10 w-10"
              color="gray"
            >
              <FaFilter />
            </Button>
            <Button
              className="justify-self-end flex justify-center items-center h-10 w-10"
              color="gray"
            >
              <FaArrowsRotate />
            </Button>
          </div>
          <Button
            onClick={() => setShowCards(!showCards)}
            className="justify-self-end flex justify-center items-center h-10 w-10"
            color="gray"
          >
            <FiMaximize className="h-5 w-5" />
          </Button>
        </div>
      </div>
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
