"use client";

import React, { useRef, useState } from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  Pagination,
  Button,
  TextInput,
  Label,
  Dropdown,
} from "flowbite-react";
import TableItem from "./components/table-item";
import { HiSearch } from "react-icons/hi";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaFilter, FaArrowsRotate } from "react-icons/fa6";
import { useSymptomsTable } from "./hooks/use-symptoms-table";
// Condition can be:
// - code black
// - critic
// - warning
// - info

export default function SymptomsTable({
  setShowCards,
  showCards,
  dict,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
  dict: any;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [_condition, setCondition] = useState<string>("");
  const pageSize = 10;

  const { tableData, loading, error } = useSymptomsTable({
    page: currentPage,
    pageSize,
    search: searchTerm,
  });

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSearchTerm(formData.get("search")?.toString() || "");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(
      Math.max(1, Math.min(page, tableData?.pagination.totalPages || 0)),
    );
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  const startItem = tableData?.pagination.currentPage
    ? (tableData?.pagination.currentPage - 1) * pageSize + 1
    : 0;

  const endItem = tableData?.pagination.currentPage
    ? Math.min(
        tableData?.pagination.currentPage * pageSize,
        tableData?.pagination.totalPages,
      )
    : 0;

  return (
    <div className="h-4/6 px-5 pb-5 pt-2 flex flex-col gap-4 w-full flex-grow">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div>
                <Label htmlFor="search" className="sr-only">
                  Search
                </Label>
                <TextInput
                  id="search"
                  name="search"
                  type="search"
                  ref={searchInputRef}
                  icon={HiSearch}
                  placeholder={dict.symptoms.search}
                  required
                  className="w-full"
                />
              </div>
            </form>
            <Dropdown
              label=""
              className="!p-0"
              renderTrigger={() => (
                <Button color="gray">
                  <FaFilter className="h-4 w-4" />
                </Button>
              )}
            >
              <Dropdown.Item onClick={() => setCondition("code black")}>
                Código Negro
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("critic")}>
                Crítico
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("treatment")}>
                Tratamiento
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("stable")}>
                Estable
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("observation")}>
                Observación
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("remission")}>
                Remisión
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("compromised")}>
                Comprometido
              </Dropdown.Item>
            </Dropdown>
            <Button
              className="justify-self-end flex justify-center items-center h-10 w-10"
              color="gray"
              onClick={() => {
                setCondition("");
                setSearchTerm("");
              }}
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
      <div className="bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg w-full h-full overflow-y-auto border-2 border-gray-300 dark:border-gray-600 transition-all duration-300">
        <Table
          striped
          className="w-full overflow-y-auto"
          theme={{
            body: {
              cell: {
                base: "px-6 py-4 group-first/body:group-first/row:first:rounded-tl-lg group-first/body:group-first/row:last:rounded-tr-lg group-last/body:group-last/row:first:rounded-bl-none group-last/body:group-last/row:last:rounded-br-none",
              },
            },
          }}
        >
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
          <TableBody className="divide-y overflow-y-auto">
            {tableData?.data.map((item, index) => (
              <TableItem key={index} data={item} dict={dict} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {tableData && tableData?.pagination.totalPages > 0 ? (
            <>
              {dict.symptoms.showing}{" "}
              <span className="font-bold">
                {startItem}-{endItem}
              </span>{" "}
              {dict.symptoms.of}{" "}
              <span className="font-bold">
                {tableData?.pagination.totalPages}
              </span>
            </>
          ) : (
            "No hay resultados"
          )}
        </p>
        {tableData && tableData?.pagination.totalPages > 0 && (
          <Pagination
            layout="pagination"
            nextLabel=""
            previousLabel=""
            currentPage={tableData?.pagination.currentPage}
            totalPages={Math.max(1, tableData?.pagination.totalPages)}
            showIcons={true}
            onPageChange={handlePageChange}
            theme={{
              pages: {
                selector: {
                  active: "bg-blue-100 text-blue-500",
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
