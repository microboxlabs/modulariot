"use client";

import React, { useRef, useState } from "react";
import { Button, TextInput, Label, Dropdown } from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaFilter, FaArrowsRotate } from "react-icons/fa6";
import TableComponent from "./components/table-component";
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

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSearchTerm(formData.get("search")?.toString() || "");
    setCurrentPage(1);
  };

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
      <div className="shadow-md rounded-lg w-full h-fit overflow-y-auto">
        <TableComponent
          dict={dict}
          currentPage={currentPage}
          pageSize={pageSize}
          searchTerm={searchTerm}
          setCurrentPage={setCurrentPage}
        />
      </div>
    </div>
  );
}
