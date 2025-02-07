import { FaClock, FaTruck } from "react-icons/fa";
import { HiChevronUp } from "react-icons/hi";
import TimedSymptoms from "./timed-symptoms";

const test_data = [
  {
    time: "9:00 - 9:30",
    total: 2210,
  },
  {
    time: "8:30 - 9:00",
    total: 2210,
  },
  {
    time: "8:00 - 8:30",
    total: 2210,
  },
]

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  return new Intl.DateTimeFormat("es-ES", options)
    .format(date)
    .toUpperCase()
    .replace(".", "");
}

function getRelativeDayText(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Remove time part
  const givenDate = new Date(date);
  givenDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((givenDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === -1) return "Ayer";
  if (diffDays > 0) return `En ${diffDays} días`;
  return `Hace ${Math.abs(diffDays)} días`;
}

export default function SymptomsData({ date }: { date: string }) {
  const [year, month, day] = date.split("-").map(Number);
  const setted_date = new Date(year, month - 1, day);

  return (
    <div className="flex flex-col gap-3">
      {/* Time data */}
      <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
        <div className="w-full flex flex-row gap-5 text-sm">
          <div className="text-black dark:text-white">{formatDate(setted_date)}</div>
          <div className="flex flex-row flex-grow justify-between">
            <p className="text-gray-500 dark:text-gray-400">{getRelativeDayText(setted_date)}</p>
            <p className="text-gray-500 dark:text-gray-400">Síntomas totales: 2210</p>
          </div>
        </div>
      </div>
      {/* Symptoms data */}
      {test_data.map((item) => (
        <div className=" pl-3 flex flex-row  text-sm gap-10">
          <div className="py-2">
            <div className="flex flex-row items-center justify-center gap-2 ">
              <FaClock color="gray" />
              <div className="flex flex-col gap-3 text-gray-500 dark:text-gray-400">
                {item.time}
              </div>
            </div>
          </div>
          <div className="flex flex-grow flex-column gap-2">
            <TimedSymptoms />
          </div>
        </div>
      ))}
    </div>
  );
}
