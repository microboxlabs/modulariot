"use client";

import { useState } from "react";
import { FaTruck } from "react-icons/fa";
import { HiChevronUp } from "react-icons/hi";
import { Conditions } from "../table-item.type";
import ConditionIcon from "../condition-icon";
import { Button } from "flowbite-react";
import { useRouter } from "next/navigation";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";

export default function TimedSymptoms({
  data,
  initial_state = false,
  dict,
}: {
  data: SymptomsICUItemResponse;
  initial_state: boolean;
  dict: any;
}) {
  const [isOpen, setIsOpen] = useState(initial_state);
  const router = useRouter();
  const item = data;
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Expandable Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex flex-row gap-2 w-full items-center justify-between transition-all duration-300 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 rounded-t-lg p-2 cursor-pointer border-b border-gray-200 dark:border-gray-700 ${isOpen ? "bg-gray-100 dark:bg-gray-800" : ""}`}
      >
        <div className="flex flex-row gap-2 items-center justify-center">
          <FaTruck color="gray" />
          <div className="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
            {item.treatment_count} {dict.symptoms.symptoms_detected}
          </div>
        </div>
        <HiChevronUp
          className={`w-5 h-5 transition-transform duration-300 ${!isOpen ? "rotate-180" : ""}`}
          color="gray"
        />
      </div>
      {/* Data */}
      <div
        className={`flex flex-col gap-2 w-full transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-[1000px]" : "max-h-0"}`}
      >
        {/* {test_data.map((item) => ( */}
        <div
          key={item.symptom_name}
          className="flex flex-col items-center justify-center mb-2"
        >
          {/* Condition */}
          <div
            className={`flex flex-row items-center p-2 gap-3 text-gray-500 dark:text-gray-400 w-full rounded-lg ${Conditions[item.icu_condition.toLowerCase()].bgColor}`} /*  */
          >
            <ConditionIcon
              condition={item.icu_condition.toLowerCase()}
              size="h-7 w-7"
            />
            <p className="text-white">{item.start_time}</p>|
            <p className="text-gray-500 dark:text-gray-400">
              {item.type_of_incidence}
            </p>
            |<p className="text-gray-500 dark:text-gray-400">{item.asset_id}</p>
            |<p className="text-gray-500 dark:text-gray-400">{item.trip_id}</p>|
            <p className="text-gray-500 dark:text-gray-400">{item.client}</p>|
            <p className="text-gray-500 dark:text-gray-400">{item.driver}</p>
          </div>
          {/* Data */}
          <div className="grid grid-cols-3 w-full p-3 gap-2">
            {/* each item in the grid is a p tag with a span tag inside */}

            {/* @TODO: {item.items.map((i) => (
                <p className="text-gray-900 dark:text-white" key={i.key}>
                  {i.key} :
                  <span className="text-gray-500 dark:text-gray-400">
                    {i.value}
                  </span>
                </p>
              ))} */}
          </div>
          {/* Diagnose button */}
          <div className="flex flex-row gap-2 w-full justify-end">
            <Button
              color="blue"
              onClick={() => router.push("/symptoms/map-view")}
            >
              {dict.symptoms.diagnose}
            </Button>
            <a
              href="https://maps.app.goo.gl/TvADzBVqJv4W91AY8"
              target="_blank"
              className="bg-blue-500 text-white px-4 py-2 rounded-md"
            >
              {dict.symptoms.geographic_view}
            </a>
          </div>
        </div>
        {/* ))} */}
      </div>
    </div>
  );
}
