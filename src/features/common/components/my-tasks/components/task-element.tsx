import React from "react";
import { FaCalendarAlt, FaExclamation } from "react-icons/fa";
import KanbanViewSwitcherIconCompressed from "@/features/svg_components/kanban_view_switcher_icon_compressed";

type TaskListElementProps = {
  type: string;
  state: string;
  service: string;
  date: string;
  duration: string;
  licensePlate: string;
  route: string;
  client: string;
  alert_level?: number;
};

export default function TaskListElement({
  alert_level,
  type,
  state,
  service,
  date,
  duration,
  licensePlate,
  route,
  client,
}: TaskListElementProps) {
  const column_base_style =
    "px-4 py-2 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 group-active:bg-blue-100 dark:group-active:bg-blue-900  group-hover:bg-gray-200  dark:group-hover:bg-gray-700 transition-all duration-200 cursor-pointer border-2 " +
    get_alert_color(alert_level);

  return (
    <div className="contents group">
      <div
        className={`whitespace-nowrap font-medium rounded-l-lg ${column_base_style} border-r-0`}
      >
        <div className="flex flex-col text-xl text-gray-900 dark:text-white">
          <div className="flex flex-row justify-between items-center w-fit">
            {type}
            <div className="flex flex-row items-end gap-[-2em]">
              {
                // Make a count of alert_level, and show that many icons ()
                [...Array(alert_level || 0)].map((_, i) => (
                  <FaExclamation
                    key={i}
                    className={"" + get_alert_color(alert_level)}
                  />
                ))
              }
            </div>
          </div>

          <div className="flex flex-row gap-4 text-sm font-light">
            <span className="text-gray-500 dark:text-gray-400">{service}</span>
            <span className="text-gray-500 dark:text-gray-400 flex flex-row items-center gap-1">
              <FaCalendarAlt />
              {date}
            </span>
            <span className="text-gray-500 dark:text-gray-400 flex flex-row items-center gap-1">
              <KanbanViewSwitcherIconCompressed className="fill-gray-500 dark:fill-gray-400 h-5 w-5" />
              {state}
            </span>
          </div>
        </div>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">{duration}</p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">{licensePlate}</p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">{route}</p>
      </div>
      <div
        className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0`}
      >
        <p className="text-lg whitespace-nowrap">{client}</p>
      </div>
      {/*
        <div
        className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0 justify-end relative`}
        >
        <p className="text-md whitespace-nowrap">
          + {get_priority_xp(alert_level)}
        </p>
      </div>
      */}
    </div>
  );
}

/*
  function get_priority_xp(alert_level: number | undefined) {
    switch (alert_level) {
      case 1:
        return "10px";
      case 2:
        return "15px";
      case 3:
        return "20px";
      default:
        return "5px";
    }
  }
*/

function get_alert_color(alert_level: number | undefined) {
  switch (alert_level) {
    case 1:
      return "border-red-400 text-red-400 group-hover:text-red-400 group-active:text-red-400 dark:border-red-900 dark:text-red-700 dark:group-hover:text-red-700 dark:group-active:text-red-700";
    case 2:
      return "border-red-600 text-red-600 group-hover:text-red-600 group-active:text-red-600 dark:text-red-600";
    case 3:
      return "border-red-800 text-red-800 group-hover:text-red-800 group-active:text-red-800 dark:border-red-500 dark:text-red-500 dark:group-hover:text-red-500 dark:group-active:text-red-500";
    default:
      return "border-transparent";
  }
}
