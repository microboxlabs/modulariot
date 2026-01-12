"use client";
import "daterangepicker/daterangepicker.css";

import React, { useEffect, useRef } from "react";
import $ from "jquery";
import "daterangepicker";
import dayjs from "dayjs";

// Extend JQuery type to include daterangepicker
declare global {
  interface JQuery {
    daterangepicker(
      options?: any,
      callback?: (start: any, end: any) => void
    ): JQuery;
  }
}

export default function DateRangePicker({
  label = "",
  onDateChange,
  className,
  minDate,
  maxDate,
  maxRangeDays,
  defaultStartDate,
  defaultEndDate,
}: {
  label?: string;
  onDateChange?: (startDate: string, endDate: string) => void;
  className?: string;
  minDate?: dayjs.Dayjs;
  maxDate?: dayjs.Dayjs;
  maxRangeDays?: number;
  defaultStartDate?: dayjs.Dayjs;
  defaultEndDate?: dayjs.Dayjs;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      $(inputRef.current).daterangepicker(
        {
          timePicker: false,
          startDate: (defaultStartDate || dayjs().subtract(3, "days")).startOf(
            "day"
          ).toDate(),
          endDate: (defaultEndDate || dayjs()).endOf("day").toDate(),
          ...(minDate && { minDate: minDate.toDate() }),
          ...(maxDate && { maxDate: maxDate.toDate() }),
          ...(maxRangeDays && {
            dateLimit: {
              days: maxRangeDays,
            },
          }),
          locale: {
            format: "YYYY-MM-DD HH:mm",
          },
          autoUpdateInput: true,
          opens: "left",
        },
        function (start, end) {
          // Callback on date range selection - convert moment objects to dayjs
          // Set start date to 00:00 and end date to 23:59
          const startWithTime = dayjs(start.toDate()).startOf("day");
          const endWithTime = dayjs(end.toDate()).endOf("day");

          const startFormatted = startWithTime.format("YYYY-MM-DD HH:mm");
          const endFormatted = endWithTime.format("YYYY-MM-DD HH:mm");

          if (onDateChange) {
            onDateChange(startFormatted, endFormatted);
          }
        }
      );

      return () => {
        if (inputRef.current) {
          $(inputRef.current).data("daterangepicker").remove();
        }
      };
    }
  }, []);

  return (
    <div
      className={` cursor-pointer transition-all duration-300 flex items-center text-sm font-light gap-1 whitespace-nowrap ${className}`}
    >
      {label}
      <input
        ref={inputRef}
        type="text"
        className="block w-full border focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:ring-primary-500 p-2.5 text-sm rounded-lg"
      />
    </div>
  );
}
