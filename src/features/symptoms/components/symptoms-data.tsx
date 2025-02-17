"use client";

import { FaClock } from "react-icons/fa";
import TimedSymptoms from "./timed-symptoms";
import { useState } from "react";

const test_data = [
  {
    time: "9:00 - 9:30",
    total: 2210,
  },
];

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
  return lang === "es" ? `Hace ${Math.abs(diffDays)} días` : `In ${Math.abs(diffDays)} days`;
}

export default function SymptomsData({ 
  date,
  container_index,
  dict,
  lang,
}: {
  date: string;
  container_index: number;
  dict: any;
  lang: string;
}) {

  const [year, month, day] = date.split("-").map(Number);
  const setted_date = new Date(year, month - 1, day);

  const [total_symptoms, setTotalSymptoms] = useState(0);

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
              {dict.symptoms.total_symptoms}: 2210
            </p>
          </div>
        </div>
      </div>
      {/* Symptoms data */}
      {test_data.map((item, index) => (
        <div key={index} className="pl-3 flex flex-row  text-sm gap-10">
          <div className="py-2">
            <div className="flex flex-row items-center justify-center gap-2 ">
              <FaClock color="gray" />
              <div className="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
                {item.time}
              </div>
            </div>
          </div>
          <div className="flex flex-grow flex-column gap-2">
            <TimedSymptoms dict={dict} initial_state={index === 0 && container_index === 0} />
          </div>
        </div>
      ))}
    </div>
  );
}
