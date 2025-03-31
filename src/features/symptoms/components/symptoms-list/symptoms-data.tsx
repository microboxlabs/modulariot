"use client";

import { FaClock } from "react-icons/fa";
import TimedSymptoms from "./timed-symptoms";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
function formatDate(date: Date, lang: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", options)
    .format(date)
    .toUpperCase()
    .replace(".", "");
}

function getRelativeDayText(date: Date, lang: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Remove time part
  const givenDate = new Date(date);
  givenDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (givenDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return lang === "es" ? "Hoy" : "Today";
  }
  if (diffDays === -1) {
    return lang === "es" ? "Ayer" : "Yesterday";
  }
  if (diffDays > 0) {
    return lang === "es" ? `En ${diffDays} días` : `In ${diffDays} days`;
  }

  if (lang == "es") {
    return `Hace ${Math.abs(diffDays)} días`;
  }

  return `In ${Math.abs(diffDays)} days`;
}

interface SymptomsDataProps {
  data: SymptomsICUItemResponse[];
  dict: I18nRecord;
  lang: string;
}

export default function SymptomsData({ data, dict, lang }: SymptomsDataProps) {
  const date_part = data[0].start_time.split("T")[0];
  const [year, month, day] = date_part.split("-").map(Number);
  const setted_date = new Date(year, month - 1, day);

  // Group data by time blocks
  const groupedData = data.reduce(
    (acc, item) => {
      const startTime = item.start_time.split("T")[1].slice(0, 5);
      const [hours, minutes] = startTime.split(":").map(Number);
      const isSecondHalf = minutes >= 30;
      const timeBlock = `${String(hours).padStart(2, "0")}:${isSecondHalf ? "30" : "00"}`;

      if (!acc[timeBlock]) {
        acc[timeBlock] = [];
      }
      acc[timeBlock].push(item);
      return acc;
    },
    {} as Record<string, SymptomsICUItemResponse[]>,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700">
      {/* Time data */}
      <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
        <div className="w-full flex flex-row gap-5 text-sm">
          <div className="text-black dark:text-white">
            {formatDate(setted_date, lang)}
          </div>
          <div className="flex flex-row flex-grow justify-between">
            <p className="text-gray-500 dark:text-gray-400">
              {getRelativeDayText(setted_date, lang)}
            </p>
          </div>
        </div>
      </div>
      {/* Symptoms data */}
      {Object.entries(groupedData).map(([timeBlock, items]) => {
        const [hours] = timeBlock.split(":").map(Number);
        const isSecondHalf = timeBlock.endsWith("30");
        const endHours = isSecondHalf ? hours + 1 : hours;
        const endMinutes = isSecondHalf ? "00" : "30";

        return (
          <div key={timeBlock} className="flex flex-col w-full">
            <hr className="my-2 border-gray-200 dark:border-gray-800" />
            <div className="pl-3 flex flex-row text-sm gap-10 mb-1">
              <div className="py-2 w-32">
                <div className="flex flex-row items-center justify-center gap-2">
                  <FaClock color="gray" />
                  <div className="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
                    {`${timeBlock} - ${String(endHours).padStart(2, "0")}:${endMinutes}`}
                  </div>
                </div>
              </div>
              <div className="flex flex-col flex-grow gap-2">
                {items.map((item, index) => (
                  <TimedSymptoms
                    key={item.id}
                    data={item}
                    dict={dict}
                    initial_state={true}
                    _with_top={index === 0}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
