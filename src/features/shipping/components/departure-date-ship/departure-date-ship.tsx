import { DepartureDateShipProps } from "./departure-date-ship.types";
import dayjs, { Dayjs } from "dayjs";
import { twMerge } from "tailwind-merge";
import { FaCalendarAlt } from "react-icons/fa";
import kanbanBoards from "../../model/kanban.json";

const color_mapping = {
  departure: {
    two_day: {
      bg: "bg-yellow-100 dark:bg-yellow-800 ",
      text: "text-yellow-800 dark:text-yellow-200",
    },
    less_than_one_day: {
      bg: "bg-red-100 dark:bg-red-800",
      text: "text-red-800 dark:text-red-200",
    },
    default: {
      bg: "bg-green-100 dark:bg-green-800",
      text: "text-green-800 dark:text-green-200",
    },
    already_departed: {
      bg: "bg-purple-100 dark:bg-indigo-800",
      text: "text-purple-800 dark:text-indigo-200",
    },
  },
  arrival: {
    bg: "bg-orange-100 dark:bg-orange-800",
    text: "text-orange-800 dark:text-orange-200",
  },
};

function shipBgColor(date: Dayjs, table_name: string) {
  const difference = date.diff(dayjs());
  const days = dayjs.duration(difference).asDays();

  const board = kanbanBoards.find((board) => board.title === table_name);

  if (board?.state === "pending") {
    if (days < 0.25) return color_mapping.departure.less_than_one_day;
    if (days < 2) return color_mapping.departure.two_day;
    return color_mapping.departure.already_departed;
  } else if (board?.state === "started") {
    return color_mapping.departure.already_departed;
  } else if (board?.state === "done") {
    return color_mapping.arrival;
  }
}

export default function DepartureDateShip({
  date,
  table_name,
}: DepartureDateShipProps) {
  // const humanizeDate = humanizeFrom(date);
  const color = shipBgColor(dayjs(date), table_name);
  const board = kanbanBoards.find((board) => board.title === table_name);
  const fixed_date = dayjs(date).format("DD/MM/YYYY");

  return (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7",
        color?.bg + " " + color?.text,
      )}
    >
      <FaCalendarAlt className={"mr-1 h-3 w-3 " + color?.text} />{" "}
      <p className="whitespace-nowrap">
        {board?.state === "pending"
          ? "Salida estimada: " + fixed_date
          : board?.state === "started"
            ? "Salida: " + fixed_date
            : "Llegada: " + fixed_date}
      </p>
    </div>
  );
}
