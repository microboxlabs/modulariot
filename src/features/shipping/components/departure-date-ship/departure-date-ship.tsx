import {
  fromString,
  humanizeFrom,
} from "@/features/common/services/days.service";
import { DepartureDateShipProps } from "./departure-date-ship.types";
import dayjs, { Dayjs } from "dayjs";
import { twMerge } from "tailwind-merge";
import CalendarMonthIcon from "@/features/icons/calendar-month";

function shipBgColor(date: Dayjs) {
  const difference = date.diff(dayjs());
  const days = dayjs.duration(difference).asDays();
  if (days < 0.25) return "bg-red-100 dark:bg-red-200 text-red-800";
  if (days < 2) return "bg-yellow-100 dark:bg-yellow-200 text-yellow-800";
  return "bg-purple-100 dark:bg-purple-200 text-purple-800";
}

export default function DepartureDateShip({
  date,
  table_name,
}: DepartureDateShipProps) {
  const dateObj = fromString(date);
  const humanizeDate = humanizeFrom(date);
  const classes = twMerge(
    "flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7",
    table_name == "tripInitiated"
      ? "bg-cyan-100 dark:bg-cyan-200 text-cyan-800"
      : shipBgColor(dateObj),
  );
  return (
    <div className={classes}>
      <CalendarMonthIcon
        className="mr-1 h-4 w-4"
        color={table_name == "tripInitiated" ? "#155E75" : ""}
      />{" "}
      <p className="whitespace-nowrap">{humanizeDate}</p>
    </div>
  );
}
