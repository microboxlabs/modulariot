import React, { useRef } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import KanbanViewSwitcherIconCompressed from "@/features/svg_components/kanban_view_switcher_icon_compressed";
import { tr } from "@/features/i18n/tr.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { FormattedDate } from "../../formatted-date/formatted-date";
import { Button } from "flowbite-react";
import Link from "next/link";
import ConditionIcon from "@/features/symptoms/components/condition-icon";
import icu_condition from "@/features/symptoms/model/icu_condition.json";

export default function TaskListElement({
  setSelectedTask,
  task,
  dict,
}: {
  setSelectedTask: (taskId: string | null) => void;
  task: KanbanBoardTask;
  dict: I18nRecord;
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // make this value be a random number between 0 and 4, but keep it stable across re-renders
  const alert_level = 0; // useMemo(() => Math.floor(Math.random() * 5), [task.id]);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setSelectedTask(task.id);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const alert_style = get_alert_color(alert_level);

  const column_base_style =
    "pl-3 pr-4 py-2 transition-all duration-200 " + alert_style.main_color;

  return (
    <div
      className="contents group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`whitespace-nowrap font-medium rounded-l-lg ${column_base_style} border-r-0`}
      >
        <div className="flex flex-row gap-2">
          <div className="flex items-center">
            <ConditionIcon
              condition={(
                icu_condition[
                  String(alert_level) as keyof typeof icu_condition
                ] as string
              ).toLowerCase()}
              dict={dict}
            />
          </div>

          <div className="flex flex-col text-xl">
            <div className="flex flex-row justify-between items-center w-fit">
              {tr(`myTasks.${task.taskType}`, dict)}
            </div>
            <div
              className={`flex flex-row gap-4 text-sm font-light ${alert_style.secundary_text}`}
            >
              <span className="">{task.name}</span>
              {task.departureDate && (
                <span className="flex flex-row items-center gap-1">
                  <FaCalendarAlt />
                  <FormattedDate date={task.departureDate} format="date" />
                </span>
              )}
              <span className="flex flex-row items-center gap-1">
                <KanbanViewSwitcherIconCompressed
                  className={`h-5 w-5 ${alert_style.secundary_text}`}
                />
                {tr(`myTasks.${task.areaType}`, dict)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          <FormattedDate date={task.duration} format="time" />
        </p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          {task.mintral_truckLicensePlate}
        </p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          {task.origin}-{task.destination}
        </p>
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">{task.client}</p>
      </div>
      <div
        className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0 justify-end relative`}
      >
        <Link
          href={`/task/edit/${task.id}`}
          className="w-fit h-fit hover-trigger"
        >
          <Button
            className="h-8 flex justify-center items-center !text-xs overflow-hidden relative"
            color="blue"
            theme={{
              color: {
                blue: "bg-blue-700 text-white focus:ring-blue-300 dark:bg-blue-600 dark:focus:ring-blue-800",
              },
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r bg-black/30 dark:bg-white/30 translate-x-[-100%] group-hover:translate-x-0 pointer-events-none transition-transform group-hover:duration-1000 duration-0 ease-out" />
            <div className="flex items-center gap-2 relative z-10">
              <p>{tr(`bento.go_to_bento`, dict)}</p>
            </div>
          </Button>
        </Link>
      </div>
    </div>
  );

  // Old implementtation
  /*
  return (
    <div className="contents group">
      <div
        className={`whitespace-nowrap font-medium rounded-l-lg ${column_base_style} border-r-0`}
      >
        <div className="flex flex-row gap-2">
          <div className="flex items-center">
            <ConditionIcon
              condition={(
                icu_condition[
                  String(alert_level) as keyof typeof icu_condition
                ] as string
              ).toLowerCase()}
              dict={dict}
            />
          </div>

          <div className="flex flex-col text-xl">
            <div className="flex flex-row justify-between items-center w-fit">
              {tr(`myTasks.${task.taskType}`, dict)}
            </div>
            <div
              className={`flex flex-row gap-4 text-sm font-light ${alert_style.secundary_text}`}
            >
              <span className="">{task.name}</span>
              <span className="flex flex-row items-center gap-1">
                <FaCalendarAlt />
                <FormattedDate date={task.departureDate} format="date" />
              </span>
              <span className="flex flex-row items-center gap-1">
                <KanbanViewSwitcherIconCompressed
                  className={`h-5 w-5 ${alert_style.secundary_text}`}
                />
                {tr(`myTasks.${task.areaType}`, dict)}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          <FormattedDate date={task.duration} format="time" />
        </p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          {task.mintral_truckLicensePlate}
        </p>
      </div>
      <div className={`flex items-center ${column_base_style} border-x-0`}>
        <p className="text-lg whitespace-nowrap">
          {task.origin}-{task.destination}
        </p>
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">{task.client}</p>
      </div>
      <div
        className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0 justify-end relative`}
      >
        <Link
          href={`/task/edit/${task.id}`}
          className="w-fit h-fit hover-trigger"
        >
          <Button
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="h-8 flex justify-center items-center !text-xs overflow-hidden relative group/button"
            color="blue"
            theme={{
              color: {
                blue: "bg-blue-700 text-white focus:ring-blue-300 dark:bg-blue-600 dark:focus:ring-blue-800",
              },
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r bg-black/10 dark:bg-white/10 translate-x-[-100%] group-hover/button:translate-x-0 pointer-events-none transition-transform group-hover/button:duration-1000 duration-0 ease-out" />
            <div className="flex items-center gap-2">
              <p>{tr(`bento.go_to_bento`, dict)}</p>
            </div>
          </Button>
        </Link>
      </div>
    </div>
  );
  */
}

function get_alert_color(alert_level: number | undefined) {
  switch (alert_level) {
    case 3:
      return {
        main_color: "bg-rose-500 group-hover:bg-rose-600 text-white",
        secundary_text: "text-rose-50 !fill-rose-50",
      };
    case 4:
      return {
        main_color: "bg-black group-hover:bg-zinc-800 text-white",
        secundary_text: "!text-gray-200 !fill-gray-200",
      };
    default:
      return {
        main_color:
          "bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 text-gray-900 dark:text-gray-100",
        secundary_text:
          "text-gray-600 dark:text-gray-400 fill-gray-600 dark:fill-gray-400",
      };
  }
}
