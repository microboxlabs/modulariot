import { FaCheck, FaMinus } from "react-icons/fa";
import { State } from "../timeline";
import { FormattedDate } from "@/features/common/components/formatted-date";
import React, { useState, useRef } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export default function TimelineStates({
  index,
  count,
  actualState,
  state,
  statesCount,
  setSelectedTask,
  dict,
}: Readonly<{
  index: number;
  count: number;
  actualState: number;
  state: State;
  statesCount: number;
  setSelectedTask: (taskId: string | null) => void;
  dict: I18nRecord;
  oferta_producto?: string | null;
  origin?: string | null;
  destination?: string | null;
}>) {
  const [hovered, setHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const is_urgent = state.urgency;
  const is_enabled = state;
  const temporalData = TemporalComponent({
    time: state.time,
    dict,
    stateCode: state.code,
  });
  const task_id = state.task_id;

  return (
    <>
      <div className="w-full flex flex-row gap-2 relative whitespace-nowrap">
        <div className="w-10 flex flex-col items-center z-10">
          {actualState > index ? (
            <div
              className={`h-12 w-12 bg-gray-800 dark:bg-gray-200 rounded-full flex items-center justify-center border-4 border-gray-50 dark:border-gray-900 text-gray-100 dark:text-gray-700 ${is_urgent ? " bg-purple-500 dark:bg-purple-400" : ""}`}
            >
              {!state.time.end && !state.time.start ? (
                <FaMinus className="h-6 w-6" />
              ) : (
                <FaCheck className="h-6 w-6" />
              )}
            </div>
          ) : (
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center border-4 bg-gray-100 dark:bg-gray-800 border-gray-50 dark:border-gray-900 ${actualState < index ? "text-gray-500" : "text-gray-700 dark:text-gray-100"}`}
            >
              <div
                className={`h-full w-full rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 ${actualState == index ? "border border-gray-500 bg-blue-50 dark:bg-blue-900" : ""} ${is_urgent ? "border-2 border-purple-500" : ""}`}
              >
                {index + 1}
              </div>
            </div>
          )}
        </div>

        {index < statesCount - 1 && (
          <div className="absolute left-5 top-10 w-0.5 h-full bg-gray-500 dark:bg-gray-100"></div>
        )}

        <div
          className={`${index != count - 1 ? "mb-10" : ""} ${is_enabled ? "" : "opacity-50"} overflow-hidden w-full flex flex-col drop-shadow-md transition-all duration-200 border ${actualState == index ? "border-gray-500 p-2 drop-shadow-md bg-blue-50 dark:bg-blue-900" + (is_urgent ? " border-purple-500" : "") : "border-transparent p-1"} rounded-md relative cursor-pointer`}
          onMouseEnter={() => {
            if (task_id == null) return;
            setHovered(true);
            // Set timer to select task after 1 second
            hoverTimeoutRef.current = setTimeout(() => {
              setSelectedTask(task_id);
            }, 1000);
          }}
          onMouseLeave={() => {
            if (task_id == null) return;
            setHovered(false);
            // Clear timer and reset selection immediately
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          }}
        >
          <div
            className={`absolute top-1/2 left-0 -translate-y-1/2 bg-gray-400/10 ${hovered ? "transition-all duration-1000 ease-out w-[100%] h-[100%]" : "w-0 h-[100%]"}`}
            style={{ zIndex: 1 }}
          />
          <DataBox temporalData={temporalData} state={state} minimal={false} />
        </div>
      </div>
    </>
  );
}

export function DataBox({
  temporalData,
  state,
  minimal = true,
  className = "",
}: Readonly<{
  temporalData: React.ReactNode;
  state: State;
  minimal: boolean;
  className?: string;
}>) {
  return (
    <div className={className}>
      {!minimal && (
        <div className="relative z-10">
          {(() => {
            return temporalData;
          })()}
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-100">
            {state.name}
          </h1>
        </div>
      )}
      <div className="text-gray-800 dark:text-gray-300 font-light flex flex-col gap-2 relative z-10">
        <div>{state.description}</div>
      </div>
    </div>
  );
}

export function TemporalComponent({
  time,
  dict,
  stateCode,
}: Readonly<{
  time: {
    start: string;
    end: string;
    compromised_time: string | null;
    delivered: boolean | null;
    duration: number | null;
  };
  dict: I18nRecord;
  stateCode?: string;
}>) {
  const start_label =
    stateCode === "DELIVERY_EXPEDITION"
      ? tr("wheres_my_load.compromised", dict)
      : tr("wheres_my_load.start", dict);

  const getEndLabel = () => {
    if (time.delivered === null) {
      return tr("wheres_my_load.end", dict);
    }
    return time.delivered
      ? tr("wheres_my_load.real", dict)
      : tr("wheres_my_load.projected", dict);
  };
  const end_label = getEndLabel();

  const isLate = (() => {
    if (stateCode !== "DELIVERY_EXPEDITION" || !time.end || !time.start) {
      return false;
    }
    const endDate = new Date(time.end);
    const startDate = new Date(time.start);
    const oneDayMs = 24 * 60 * 60 * 1000;
    return endDate.getTime() - startDate.getTime() > oneDayMs;
  })();

  return (
    <div
      className={`text-sm font-light flex flex-col md:flex-row gap-2 text-gray-500 dark:text-gray-400`}
    >
      <span>
        {start_label}:{" "}
        <span className={`whitespace-nowrap`}>
          <FormattedDate
            date={time.start}
            format="datetime"
            locale="es-CL"
            timeZone="America/Santiago"
          />
        </span>
      </span>
      <span className={isLate ? "text-red-500 dark:text-red-400" : ""}>
        {end_label}:{" "}
        <span className={`whitespace-nowrap`}>
          <FormattedDate
            date={time.end}
            format="datetime"
            locale="es-CL"
            timeZone="America/Santiago"
          />
        </span>
      </span>
    </div>
  );
}
