"use client";

import React, { useRef, useState } from "react";
import { Button, TextInput, Label, Dropdown } from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaFilter, FaArrowsRotate } from "react-icons/fa6";
import TableComponent from "./components/table-component";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import icu_code from "./model/icu_condition.json";
import UserStateCounter from "./components/user-counter";
export default function SymptomsTable({
  setShowCards,
  showCards,
  dict,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
  dict: I18nRecord;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [condition, setCondition] = useState<string>("");
  const pageSize = 10;

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSearchTerm(formData.get("search")?.toString() || "");
    setCondition(formData.get("condition")?.toString() || "");
    setCurrentPage(1);
  };

  return (
    <div className="px-5 flex flex-col flex-grow gap-2 w-full overflow-visible">
      <div className="flex justify-between items-center overflow-visible">
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
                placeholder={(dict.symptoms as I18nRecord).search as string}
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
            <Dropdown.Item onClick={() => setCondition(icu_code["code_black"])}>
              Código Negro
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setCondition(icu_code["critical_condition"])}
            >
              Crítico
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setCondition(icu_code["under_treatment"])}
            >
              Tratamiento
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setCondition(icu_code["stable"])}>
              Estable
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setCondition(icu_code["under_observation"])}
            >
              Observación
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setCondition(icu_code["remission_state"])}
            >
              Remisión
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setCondition(icu_code["compromised_condition"])}
            >
              Comprometido
            </Dropdown.Item>
          </Dropdown>
          <Button
            className={`justify-self-end flex justify-center items-center h-10 w-10 ${
              showCards ? "animate-hide" : "animate-show-flex"
            }`}
            color="gray"
            onClick={() => {
              setCondition("");
              setSearchTerm("");
            }}
          >
            <FaArrowsRotate />
          </Button>
        </div>
        <div className="flex gap-2">
          <UserStateCounter dict={dict} />
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
      <TableComponent
        dict={dict}
        currentPage={currentPage}
        pageSize={pageSize}
        searchTerm={searchTerm}
        setCurrentPage={setCurrentPage}
        condition={condition}
      />
    </div>
  );
}
