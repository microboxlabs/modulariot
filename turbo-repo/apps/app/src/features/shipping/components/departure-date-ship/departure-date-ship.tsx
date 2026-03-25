import { DepartureDateShipProps } from "./departure-date-ship.types";
import dayjs, { Dayjs } from "dayjs";
import { twMerge } from "tailwind-merge";
import { FaCalendarAlt, FaCalendarCheck } from "react-icons/fa";
import kanbanBoards from "../../model/kanban.json";
import kanbanBoardsV2 from "../../model/kanban-shipping-v2.json";
import kanbanPlanningBoards from "../../model/kanban-planning.json";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { FormattedDate } from "@/features/common/components/formatted-date";

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
  } else if (board?.state === "done" || board?.state === "doneNotFinished") {
    return color_mapping.arrival;
  }
}

export default function DepartureDateShip({
  dict,
  date,
  table_name,
  compact,
}: DepartureDateShipProps) {
  // const humanizeDate = humanizeFrom(date);

  const board = kanbanBoards.find((board) => board.title === table_name);
  const boardV2 = kanbanBoardsV2.find((board) => board.title === table_name);
  const boardDelivery = kanbanBoardsV2.find(
    (board) => board.title === table_name
  );

  const boardPlanning = kanbanPlanningBoards.find(
    (board) => board.title === table_name
  );
  console.log("boardPlanning", boardPlanning);
  console.log("table_name", table_name);

  const color = shipBgColor(dayjs(date), table_name);
  const fixed_date = dayjs(date).format("MM/DD/YYYY");

  return (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7 gap-1",
        color?.bg + " " + color?.text,
        "dark:text-white"
      )}
    >
      {board?.state === "done" ||
      board?.state === "started" ||
      boardV2?.state === "done" ||
      boardV2?.state === "started" ||
      boardDelivery?.state === "done" ||
      boardDelivery?.state === "started" ||
      boardPlanning?.state === "done" ||
      boardPlanning?.state === "started" ? (
        <FaCalendarCheck className={"h-3 w-3 " + color?.text} />
      ) : (
        <FaCalendarAlt className={"h-3 w-3 " + color?.text} />
      )}
      <p className={`whitespace-nowrap ${compact ? "hidden" : ""}`}>
        {board?.state === "pending" ||
        board?.state === "started" ||
        boardV2?.state === "pending" ||
        boardV2?.state === "started" ||
        boardDelivery?.state === "pending" ||
        boardDelivery?.state === "started" ||
        boardPlanning?.state === "pending" ||
        boardPlanning?.state === "started"
          ? (dict.kanban as I18nRecord).departure + " "
          : (dict.kanban as I18nRecord).arrival + " "}
        <FormattedDate date={fixed_date} format="date" />
      </p>
    </div>
  );
}
