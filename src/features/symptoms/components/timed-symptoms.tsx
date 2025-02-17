"use client";

import { useState } from "react";
import { FaTruck } from "react-icons/fa";
import { HiChevronUp } from "react-icons/hi";
import { Conditions } from "./table-item.type";
import ConditionIcon from "./condition-icon";
import { Button } from "flowbite-react";
import { useRouter } from "next/navigation";

const test_data = [
  {
    condition: "code black",
    licensePlate: "TLGK52",
    time: "30 seg.",
    trip: "STG-ANF",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
    icon: "example.svg",
    type_of_incidence: "Exceso Velocidad Gravisimo",
    asset_id: "TLGK52",
    trip_id: "14440987",
    client: "BHP",
    driver: "Schumacher Michael",
    items: [
      {
        key: "start",
        value: "2025-02-15 14:10:02+00",
      },
      {
        key: "end",
        value: "2025-02-15 14:30:02+00",
      },
      {
        key: "duration_sec",
        value: 1200,
      },
      {
        key: "signals",
        value: 400,
      },
      {
        key: "signals_per_minute",
        value: 20,
      },
      {
        key: "average_speed",
        value: 96,
      },
      {
        key: "speed_limit_reference",
        value: 60,
      },
      /* {
        key: "geographical_reference_point",
        value: "0101000020E6100000BD3AC780EC9351C050FEEE1D35C637C0",
      }, */
      {
        key: "treatments",
        value: "0",
      },
    ],
  },
  {
    condition: "code black",
    licensePlate: "TLGK52",
    time: "30 seg.",
    trip: "STG-ANF",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",

    icon: "example.svg",
    type_of_incidence: "Detención No Autorizada",
    asset_id: "RLGD35",
    trip_id: "14440987",
    client: "COLLAHUASI",
    driver: "Alonso Fernando",
    items: [
      {
        key: "start",
        value: "2025-02-15 14:04:02+00",
      },
      {
        key: "end",
        value: "2025-02-15 14:09:02+00",
      },
      {
        key: "duration_sec",
        value: 300,
      },
      {
        key: "signals",
        value: 15,
      },
      {
        key: "signals_per_minute",
        value: 3,
      },
      {
        key: "average_speed",
        value: 0,
      },
      {
        key: "engine_on",
        value: "true",
      },
      /* {
        key: "geographical_reference_point",
        value: "0101000020E6100000BD3AC780EC9351C050FEEE1D35C637C0",
      }, */
      {
        key: "treatments",
        value: "1",
      },
    ],
  },
  {
    condition: "code black",
    licensePlate: "TLGK52",
    time: "30 seg.",
    trip: "STG-ANF",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",

    icon: "example.svg",
    type_of_incidence: "Conducción Maxima Continua",
    asset_id: "MVRB01",
    trip_id: "14440987",
    client: "MBL",
    driver: "Verstapen Max",
    items: [
      {
        key: "start",
        value: "2025-02-15 14:20:02+00",
      },
      {
        key: "end",
        value: "2025-02-15 15:10:02+00",
      },
      {
        key: "duration_sec",
        value: 3000,
      },
      {
        key: "signals",
        value: 1000,
      },
      {
        key: "signals_per_minute",
        value: 20,
      },
      {
        key: "average_speed",
        value: 82,
      },
      {
        key: "engine_on",
        value: "true",
      },
      /* {
        key: "geographical_reference_point",
        value: "0101000020E6100000BD3AC780EC9351C050FEEE1D35C637C0",
      }, */
      {
        key: "treatments",
        value: "2",
      },
    ],
  },
];

export default function TimedSymptoms({
  initial_state = false,
  dict,
}: {
  initial_state: boolean;
  dict: any;
}) {
  const [isOpen, setIsOpen] = useState(initial_state);
  const router = useRouter();
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
            {test_data.length} {dict.symptoms.symptoms_detected}
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
        {test_data.map((item) => (
          <div
            key={item.condition}
            className="flex flex-col items-center justify-center mb-2"
          >
            {/* Condition */}
            <div
              className={`flex flex-row items-center p-2 gap-3 text-gray-500 dark:text-gray-400 w-full rounded-lg ${Conditions[item.condition].bgColor}`}
            >
              <ConditionIcon condition={item.condition} size="h-7 w-7" />
              <p className="text-white">{item.date}</p>|
              <p className="text-gray-500 dark:text-gray-400">
                {item.type_of_incidence}
              </p>
              |
              <p className="text-gray-500 dark:text-gray-400">
                {item.asset_id}
              </p>
              |
              <p className="text-gray-500 dark:text-gray-400">{item.trip_id}</p>
              |<p className="text-gray-500 dark:text-gray-400">{item.client}</p>
              |<p className="text-gray-500 dark:text-gray-400">{item.driver}</p>
            </div>
            {/* Data */}
            <div className="grid grid-cols-3 w-full p-3 gap-2">
              {/* each item in the grid is a p tag with a span tag inside */}

              {item.items.map((i) => (
                <p className="text-gray-900 dark:text-white" key={i.key}>
                  {i.key} :
                  <span className="text-gray-500 dark:text-gray-400">
                    {i.value}
                  </span>
                </p>
              ))}
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
        ))}
      </div>
    </div>
  );
}
