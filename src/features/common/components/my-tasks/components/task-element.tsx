import React, { useRef } from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { KanbanBoardTask } from "@/features/shipping/types/common.types";
import { FormattedDate } from "../../formatted-date/formatted-date";
import { GoToBentoButton } from "./go-to-bento-button";
import { TaskPrimaryInfo } from "./task-primary-info";

export default function TaskListElement({
  setSelectedTask,
  task,
  dict,
  minimized = false,
}: {
  setSelectedTask: (taskId: string | null) => void;
  task: KanbanBoardTask;
  dict: I18nRecord;
  minimized?: boolean;
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

  if (minimized) {
    return (
      <div className="flex flex-row w-full">
        <div
          className={`whitespace-nowrap font-medium rounded-l-lg ${column_base_style} border-r-0 w-full`}
        >
          <TaskPrimaryInfo
            task={task}
            dict={dict}
            alert_level={alert_level}
            alert_style={alert_style}
          />
        </div>
        <div
          className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0 justify-end relative`}
        >
          <GoToBentoButton
            taskId={task.id}
            dict={dict}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="contents">
      <div
        className={`whitespace-nowrap font-medium rounded-l-lg ${column_base_style} border-r-0`}
      >
        <TaskPrimaryInfo
          task={task}
          dict={dict}
          alert_level={alert_level}
          alert_style={alert_style}
        />
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">
          <FormattedDate date={task.duration} format="time" />
        </p>
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">
          {task.mintral_truckLicensePlate}
        </p>
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">
          {task.origin}-{task.destination}
        </p>
      </div>
      <div
        className={`flex items-center ${column_base_style} font-light border-x-0`}
      >
        <p className="text-lg whitespace-nowrap">{task.client || "-"}</p>
      </div>
      <div
        className={`flex items-center rounded-r-lg ${column_base_style} font-light border-l-0 justify-end relative`}
      >
        <GoToBentoButton
          taskId={task.id}
          dict={dict}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
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
