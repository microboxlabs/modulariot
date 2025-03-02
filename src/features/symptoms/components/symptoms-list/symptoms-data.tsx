"use client";

import { FaClock } from "react-icons/fa";
import TimedSymptoms from "./timed-symptoms";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";

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
  dict: any;
  lang: string;
}

export default function SymptomsData({ data, dict, lang }: SymptomsDataProps) {
  const date_part = data[0].start_time.split("T")[0];
  const [year, month, day] = date_part.split("-").map(Number);
  const setted_date = new Date(year, month - 1, day);

  return (
    <div className="flex flex-col gap-3">
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
            <p className="text-gray-500 dark:text-gray-400">
              {dict.symptoms.total_treatment}:
              {data.reduce((acc, item) => acc + item.treatment_count, 0)}
            </p>
          </div>
        </div>
      </div>
      {/* Symptoms data */}
      {/* {test_data.map((item, index) => ( */}
      {data.map((item) => (
        <div className="pl-3 flex flex-row  text-sm gap-10" key={item.id}>
          <div className="py-2">
            <div className="flex flex-row items-center justify-center gap-2 ">
              <FaClock color="gray" />
              <div className="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
                {item.start_time.split("T")[1].slice(0, 5)}
              </div>
            </div>
          </div>
          <div className="flex flex-grow flex-column gap-2" key={item.id}>
            <TimedSymptoms data={item} dict={dict} initial_state={true} />
          </div>
        </div>
      ))}
      {/* ))} */}
    </div>
  );
}
