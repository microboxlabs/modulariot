import { Datepicker } from "flowbite-react";
import { useState } from "react";
import { FaCalendar } from "react-icons/fa";

export default function DateSelections() {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [openFromDate, setOpenFromDate] = useState(false);
  const [openToDate, setOpenToDate] = useState(false);
  const [fromDate, setFromDate] = useState<any>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  };

  return (
    <div className="relative transition-all duration-300">
      <div
        className="h-10 w-10 select-none cursor-pointer relative flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600"
        onClick={() => setOpen(!open)}
      >
        <FaCalendar className="text-gray-500 dark:text-gray-400" />
      </div>
      {open && (
        <div className="mt-2 absolute top-full left-0 bg-white dark:bg-gray-700 rounded-lg flex flex-col gap-2 border border-gray-300 dark:border-gray-600">
          <div className="flex flex-col overflow-hidden rounded-lg">
            <div
              className={`whitespace-nowrap font-light bg-gray-100 dark:bg-gray-700 text-gray-300 p-2 transition-all duration-300 ${
                openToDate ? "opacity-50" : "opacity-100"
              }`}
            >
              Desde:{" "}
              <span
                className="text-gray-500 dark:text-gray-400 bg-gray-600 rounded-lg px-2 py-1 hover:bg-gray-500 dark:hover:bg-gray-600 cursor-pointer w-80"
                onClick={() => {
                  setOpenFromDate(!openFromDate);
                  setOpenToDate(false);
                }}
              >
                {fromDate ? formatDate(fromDate) : "--/--/----"}
              </span>
            </div>
            <div
              className={`whitespace-nowrap font-light bg-gray-100 dark:bg-gray-700 text-gray-300 p-2 transition-all duration-300 ${
                openFromDate ? "opacity-50" : "opacity-100"
              }`}
            >
              Hasta:{" "}
              <span
                className="text-gray-500 dark:text-gray-400 bg-gray-600 rounded-lg px-2 py-1 hover:bg-gray-500 dark:hover:bg-gray-600 cursor-pointer w-80"
                onClick={() => {
                  setOpenToDate(!openToDate);
                  setOpenFromDate(false);
                }}
              >
                {toDate ? formatDate(toDate) : "--/--/----"}
              </span>
            </div>
          </div>
          <div
            className={`absolute left-full transition-all duration-300 ml-2 bg-gray-700 overflow-hidden border border-gray-300 rounded-lg ${openFromDate || openToDate ? "scale-100" : "scale-0"}`}
          >
            <div className="border-b bg-gray-100 dark:bg-gray-800 border-gray-600 p-2 text-gray-300 flex items-center justify-center">
              {openFromDate ? "Desde" : "Hasta"}
            </div>
            <Datepicker
              inline
              onChange={(date) => setFromDate(date)}
              className="bg-gray-100 dark:bg-gray-800"
              onSelectedDateChanged={(date) => {
                if (openFromDate) {
                  setFromDate(date);
                } else {
                  setToDate(date);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
