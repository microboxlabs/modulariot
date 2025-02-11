"use client";

import { useState } from "react";
import { FaTruck } from "react-icons/fa";
import { HiChevronUp } from "react-icons/hi";
import { Conditions } from "./table-item.type";
import ConditionIcon from "./condition-icon";
import { Button } from "flowbite-react";

const test_data = [
  {
    condition: "code black",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "code black",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
  {
    condition: "code black",
    licensePlate: "XX BB 21",
    time: "30 seg.",
    trip: "STG-ANF",
    driver: "ANONIMO ANDRÉS",
    date: "2025-01-01 12:00:00",
    service: "V1406865",
    alertType: "Conducción máxima continua",
  },
];

export default function TimedSymptoms() {
  const [isOpen, setIsOpen] = useState(false);

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
            {test_data.length} Síntomas detectados
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
              <p className="text-white">08:22:52</p>
              <p className="text-gray-500 dark:text-gray-400">
                {item.licensePlate}
              </p>
            </div>
            {/* Data */}
            <div className="grid grid-cols-3 w-full p-3 gap-2">
              <p>
                Conductor:{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  {item.driver}
                </span>
              </p>
              <p>
                Modelo:{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  Volvo Gama FH
                </span>
              </p>
              <p>
                Tiempo de trayecto:{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  16:33:12 hrs
                </span>
              </p>
              <p>
                Contacto:{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  +56 9 8348 5032
                </span>
              </p>
              <p>
                Tipo de carga:{" "}
                <span className="text-gray-500 dark:text-gray-400">Rampla</span>
              </p>
              <p>
                Otros:{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  xxxxxxxx
                </span>
              </p>
            </div>
            {/* Diagnose button */}
            <div className="flex flex-row gap-2 w-full justify-end">
              <Button>Diagnóstico</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
