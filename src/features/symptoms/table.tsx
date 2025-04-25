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
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
export default function SymptomsTable({
  setShowCards,
  showCards,
  dict,
}: {
  setShowCards: (showCards: boolean) => void;
  showCards: boolean;
  dict: I18nRecord;
}) {
  const searchParams = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search"));
  const [condition, setCondition] = useState<string>("");
  const pageSize = 10;

  const search = searchParams.get("search");

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams.get("search")]);

  useEffect(() => {
    if (search && search !== "") {
      setSearchTerm(search);
      setCondition(searchParams.get("condition") || "");
      setCurrentPage(1);
    }
  }, [searchTerm]);

  return (
    <div className="px-5 flex flex-col flex-grow gap-2 w-full overflow-visible">
      <div className="flex justify-between items-center overflow-visible">
        <div className="flex gap-2 items-center">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            {(dict.symptoms as I18nRecord).active_symptoms as string}
          </h1>
          {/*
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
          */}
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
        searchTerm={searchTerm || ""}
        setCurrentPage={setCurrentPage}
        condition={condition}
      />
    </div>
  );
}
