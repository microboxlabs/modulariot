import { humanizeFrom } from "@/features/common/services/days.service";
import { DepartureDateShipProps } from "./departure-date-ship.types";
import dayjs, { Dayjs } from "dayjs";
import { twMerge } from "tailwind-merge";
import { FaCalendarAlt } from "react-icons/fa";

function _shipBgColor(date: Dayjs) {
  const difference = date.diff(dayjs());
  const days = dayjs.duration(difference).asDays();
  if (days < 0.25) return "bg-red-100 dark:bg-red-200 text-red-800";
  if (days < 2) return "bg-yellow-100 dark:bg-yellow-200 text-yellow-800";
  return "bg-purple-100 dark:bg-purple-200 text-purple-800";
}

const color_mapping = {
  departure: {
    bg: "bg-purple-100 dark:bg-indigo-800",
    text: "text-purple-800 dark:text-indigo-200",
  },
  arrival: {
    bg: "bg-orange-100 dark:bg-orange-800",
    text: "text-orange-800 dark:text-orange-200",
  },
  default: {
    bg: "bg-pink-100 dark:bg-pink-800",
    text: "text-pink-800 dark:text-pink-200",
  },
};
export default function DepartureDateShip({
  category,
  date,
}: DepartureDateShipProps) {
  const humanizeDate = humanizeFrom(date);

  return (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-lg px-3 text-sm font-medium h-7",
        category && color_mapping[category]
          ? color_mapping[category].bg + " " + color_mapping[category].text
          : color_mapping.default.bg + " " + color_mapping.default.text,
      )}
    >
      <FaCalendarAlt
        className={
          "mr-1 h-3 w-3 " +
          (category && color_mapping[category]
            ? color_mapping[category].text
            : color_mapping.default.text)
        }
      />{" "}
      <p className="whitespace-nowrap">{humanizeDate}</p>
    </div>
  );
}
