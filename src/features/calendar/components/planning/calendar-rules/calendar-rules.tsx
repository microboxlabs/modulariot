"use client";

import { Button } from "flowbite-react";
import { useState } from "react";
import { FaGear } from "react-icons/fa6";
import QuotaManager from "./quota-manager";
import TimeBlockManager from "./time-block-manager";
import { ChevronLeft } from "flowbite-react-icons/outline";
import { type TimeWindow, type TimeBlock } from "../planning-selection-context";

interface CalendarRulesProps {
  onRulesChange?: (windows: TimeWindow[]) => void;
  onBlocksChange?: (blocks: TimeBlock[]) => void;
}

export default function CalendarRules({
  onRulesChange,
  onBlocksChange,
}: Readonly<CalendarRulesProps>) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"quota" | "timeBlock" | null>(null);

  return (
    <div className="relative">
      <Button
        color="alternative"
        size="sm"
        onClick={() => {
          setSelected(null);
          setOpen(!open);
        }}
        title="Configurar ventanas de tiempo"
      >
        <FaGear />
      </Button>
      {open && (
        <div className="absolute z-50 right-0 top-full mt-2 h-fit bg-white dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[320px] w-[400px]">
          <div className="">
            <div
              role={selected !== "quota" ? "button" : undefined}
              tabIndex={selected !== "quota" ? 0 : undefined}
              onClick={() => {
                if (selected !== "quota") setSelected("quota");
              }}
              onKeyDown={(e) => {
                if (
                  selected !== "quota" &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  setSelected("quota");
                }
              }}
              className={`w-full transition-all duration-300 overflow-hidden ${selected !== "timeBlock" ? "h-20" : "h-0"} ${selected === "quota" ? "" : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"}`}
            >
              <div
                className={`flex flex-row h-full items-center px-4 transition-all duration-500 ${selected !== "quota" ? "gap-0" : "gap-4"}`}
              >
                <Button
                  className={`h-10 w-10 shrink-0 text-gray-700 p-0 transition-all duration-300 overflow-hidden ${selected !== "quota" ? "opacity-0 max-w-0 scale-75" : "opacity-100 max-w-10 scale-100"}`}
                  color="alternative"
                  disabled={selected !== "quota"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                >
                  <ChevronLeft />
                </Button>
                <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
                    Gestion de cupos
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-left">
                    Define las ventanas de tiempo disponibles asi como sus cupos
                    maximos.
                  </p>
                </div>
              </div>
            </div>
            <div
              className={`${selected !== "quota" ? "max-h-0 " : "max-h-[500px]"} transition-all duration-300 overflow-hidden`}
            >
              <QuotaManager
                onRulesChange={(windows) => {
                  onRulesChange?.(windows);
                  setOpen(false);
                }}
              />
            </div>
          </div>

          <div
            role={selected !== "timeBlock" ? "button" : undefined}
            tabIndex={selected !== "timeBlock" ? 0 : undefined}
            onClick={() => {
              if (selected !== "timeBlock") setSelected("timeBlock");
            }}
            onKeyDown={(e) => {
              if (
                selected !== "timeBlock" &&
                (e.key === "Enter" || e.key === " ")
              ) {
                setSelected("timeBlock");
              }
            }}
            className={`w-full transition-all duration-300 overflow-hidden ${selected !== "quota" ? "h-20" : "h-0"} ${selected === "timeBlock" ? "" : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"}`}
          >
            <div className="relative flex flex-row h-full items-center pl-4 pr-4">
              <div
                className={`absolute left-4 transition-all duration-300 ease-out ${selected === "timeBlock" ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}
              >
                <Button
                  className="h-10 w-10 shrink-0 text-gray-700 p-0"
                  color="alternative"
                  disabled={selected !== "timeBlock"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                >
                  <ChevronLeft />
                </Button>
              </div>
              <div
                className={`py-3 w-full transition-all duration-300 ease-out ${selected === "timeBlock" ? "ml-14" : "ml-0"}`}
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-left">
                  Bloqueos temporales
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-left">
                  Define periodos horarios o diarios como "bloqueados".
                </p>
              </div>
            </div>
          </div>
          <div
            className={`${selected !== "timeBlock" ? "max-h-0 " : "max-h-[500px]"} transition-all duration-300 overflow-hidden`}
          >
            <TimeBlockManager
              onBlocksChange={(blocks) => {
                onBlocksChange?.(blocks);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export type { TimeWindow, TimeBlock };
