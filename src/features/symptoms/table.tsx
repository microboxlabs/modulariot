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
  Dropdown,
} from "flowbite-react";
import TableItem from "./components/table-item";
import { HiSearch } from "react-icons/hi";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaFilter } from "react-icons/fa";
import { FaArrowsRotate } from "react-icons/fa6";
import { useSymptomsTable } from "./hooks/use-symptoms-table";
import { useRef, useState } from "react";
// Condition can be:
// - code black
// - critic
// - warning
// - info

export default function SymptomsTable({
  setShowCards,
  showCards,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [condition, setCondition] = useState<string>("");
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

  // Handle page change safely
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, tableData?.pagination.totalPages || 0)));
  };

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
    </div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  // Calculate display ranges safely
  const startItem = tableData?.pagination.currentPage ? ((tableData?.pagination.currentPage - 1) * pageSize) + 1 : 0;
  const endItem = tableData?.pagination.currentPage ? Math.min(tableData?.pagination.currentPage * pageSize, tableData?.pagination.totalPages) : 0;

  return (
    <div className="px-5 pb-5 pt-2 flex flex-col gap-4 w-full">
      <div className="flex flex-row justify-between w-full text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Condiciones
        <div className="flex flex-row gap-2 h-full">
          <div
            className={`flex flex-row gap-2 h-full overflow-hidden transition-all duration-300 
              ${!showCards ? "max-w-[1000px]" : "max-w-0"}
            `}
          >
            <form onSubmit={handleSearch} className="hidden lg:block">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <TextInput
                className="w-full"
                icon={HiSearch}
                id="search"
                name="search"
                placeholder="Search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                ref={searchInputRef}
                autoFocus
              />
            </form>
            <Dropdown
              label=""
              renderTrigger={() => (
                <Button
                  className="justify-self-end flex justify-center items-center h-10 w-10"
                  color="gray"
                >
                  <FaFilter />
                </Button>
              )}
            >
              <Dropdown.Header>
                <span className="block text-sm">Filtrar por condición</span>
              </Dropdown.Header>
              <Dropdown.Item onClick={() => setCondition("code black")}>Código Negro</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("critic")}>Crítico</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("treatment")}>Tratamiento</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("stable")}>Estable</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("observation")}>Observación</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("remission")}>Remisión</Dropdown.Item>
              <Dropdown.Item onClick={() => setCondition("compromised")}>Comprometido</Dropdown.Item>
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
      <div className="shadow-md rounded-lg w-full h-fit overflow-y-auto">
        <Table striped className="w-full">
          <TableHead>
            <TableHeadCell>Condición</TableHeadCell>
            <TableHeadCell>Tiempo Activo</TableHeadCell>
            <TableHeadCell>viaje</TableHeadCell>
            <TableHeadCell>Conductor</TableHeadCell>
            <TableHeadCell>Fecha de salida</TableHeadCell>
            <TableHeadCell>Servicio</TableHeadCell>
            <TableHeadCell>Tipo de alerta</TableHeadCell>
            <TableHeadCell>Estado</TableHeadCell>
          </TableHead>
          <TableBody className="divide-y">
            {tableData?.data.map((item, index) => (
              <TableItem key={index} data={item} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {tableData && tableData?.pagination.totalPages > 0 ? (
            <>
              Mostrando <span className="font-bold">{startItem}-{endItem}</span> de{" "}
              <span className="font-bold">{tableData?.pagination.totalPages}</span>
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
          />
        )}
      </div>
    </div>
  );
}
