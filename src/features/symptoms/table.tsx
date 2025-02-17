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
import { FiMaximize, FiMinimize } from "react-icons/fi";
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
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
    status: "pia@mintral.com",
  },
  {
    condition: "critic",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
    status: null,
  },
  {
    condition: "treatment",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
    status: null,
  },
  {
    condition: "stable",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
    status: "johnny.green@mintral.com",
  },
  {
    condition: "compromised",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
    status: null,
  },
  /*
  {
    condition: "observation",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
  },
  {
    condition: "remission",
    licensePlate: "XX BB 21",
    time: "30",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "maximum_continuous_driving",
  },
  */
];

export default function SymptomsTable({
  setShowCards,
  showCards,
  dict,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
  dict: any;
}) {
  return (
    <div className="px-5 pb-5 pt-2 flex flex-col gap-4 w-full">
      <div className="flex flex-row justify-between w-full text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        {dict.symptoms.conditions}
        <div className="flex flex-row gap-2 h-full">
          <div
            className={`flex flex-row gap-2 h-full overflow-hidden transition-all duration-300 
              ${!showCards ? "max-w-[1000px]" : "max-w-0"}
            `}
          >
            <form className="hidden lg:block">
              <Label htmlFor="search" className="sr-only">
                {dict.symptoms.search}
              </Label>
              <TextInput
                className="w-full "
                icon={HiSearch}
                id="search"
                name="search"
                placeholder={dict.symptoms.search}
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
            {showCards ? (
              <FiMaximize className="h-5 w-5" />
            ) : (
              <FiMinimize className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      <div className="shadow-md rounded-lg w-full h-fit overflow-y-auto">
        <Table striped className="w-full">
          <TableHead>
            <TableHeadCell>{dict.symptoms.condition}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.active_time}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.trip}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.driver}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.departure_date}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.service}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.alert_type}</TableHeadCell>
            <TableHeadCell>{dict.symptoms.state}</TableHeadCell>
          </TableHead>
          <TableBody className="divide-y">
            {data.map((item) => (
              <TableItem key={item.condition} data={item} dict={dict} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {dict.symptoms.showing} <span className="font-bold">1-10</span> {dict.symptoms.of}{" "}
          <span className="font-bold">1000</span>
        </p>
        <Pagination
          layout="pagination"
          nextLabel=""
          previousLabel=""
          currentPage={1}
          totalPages={100}
          showIcons={true}
          onPageChange={() => { }}
          theme={{
            pages: {
              selector: {
                active: "bg-blue-100 text-blue-500",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
