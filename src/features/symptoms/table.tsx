"use client";

import React, { useState } from "react";
import { Button } from "flowbite-react";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { FaArrowsRotate } from "react-icons/fa6";
import TableComponent from "./components/table-component";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import UserStateCounter from "./components/user-counter";
import { useSearchParams, useRouter } from "next/navigation";
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
  const router = useRouter();

  const [icuCode, setIcuCode] = useState<string>("");
  const date_from = searchParams.get("date_from");
  const date_to = searchParams.get("date_to");
  const date_now = new Date().toISOString().split("T")[0];

  return (
    <div className="px-5 flex flex-col flex-grow gap-2 w-full overflow-visible">
      <div className="flex justify-between items-center overflow-visible">
        <div className="flex gap-2 items-center">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white flex flex-row items-center gap-2">
            {date_from && date_to
              ? (tr("symptoms.historic_symptoms", dict) as string)
              : (tr("symptoms.active_symptoms", dict) as string)}
            <Button
              color="alternative"
              onClick={() => {
                // If the date_from and date_to exists, delete them from the search params
                const params = new URLSearchParams(searchParams.toString());
                if (date_from && date_to) {
                  params.delete("date_from");
                  params.delete("date_to");
                  router.push(`?${params.toString()}`);
                }
              }}
              disabled={!(date_from && date_to)}
              className="opacity-100 transition-all duration-200 ring-0 active:ring active:ring-gray-500 dark:active:ring-gray-500 focus:ring-0 bg-transparent dark:bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 border-transparent dark:border-transparent text-sm p-1 h-fit"
            >
              <span
                className={`flex flex-row items-center gap-1 ${date_from && date_to ? "text-gray-500" : "text-red-500"} text-sm font-light`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${date_from && date_to ? "bg-gray-500" : "bg-red-500"}`}
                ></div>
                {tr("symptoms.live", dict) as string}
              </span>
            </Button>
          </h1>
        </div>
        <div className="flex gap-2">
          <UserStateCounter dict={dict} />
          <Button
            onClick={() => setShowCards(!showCards)}
            color="alternative"
            className="h-10 w-10 p-0"
          >
            {showCards ? (
              <FiMaximize className="h-5 w-5" />
            ) : (
              <FiMinimize className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      <TableComponent dict={dict} />
    </div>
  );
}
