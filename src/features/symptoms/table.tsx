"use client";

import React, { useState } from "react";
import { Button } from "flowbite-react";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaArrowsRotate } from "react-icons/fa6";
import TableComponent from "./components/table-component";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import UserStateCounter from "./components/user-counter";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { tr } from "../i18n/tr.service";
import { useSymptomsTable } from "@/features/common/providers/client-api.provider";

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

  const { isValidating, refetch } = useSymptomsTable({
    page: currentPage,
    pageSize,
    search: searchTerm || "",
    condition,
  });

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
            {tr("symptoms.active_symptoms", dict) as string}
          </h1>
          <Button
            className={`flex justify-center items-center ${showCards ? "animate-hide" : "animate-show-flex"}`}
            color="alternative"
            disabled={isValidating}
            onClick={() => {
              setCondition("");
              setSearchTerm("");
              refetch();
            }}
          >
            <FaArrowsRotate className={isValidating ? "animate-spin" : ""} />
          </Button>
        </div>
        <div className="flex gap-2">
          <UserStateCounter dict={dict} />
          <Button onClick={() => setShowCards(!showCards)} color="alternative">
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
