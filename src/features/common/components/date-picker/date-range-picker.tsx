"use client";
import "daterangepicker/daterangepicker.css";

import React, { useEffect, useRef } from "react";
import $ from "jquery";
import "daterangepicker";
import moment from "moment";

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
}: {
  label?: string;
  onDateChange?: (startDate: string, endDate: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      $(inputRef.current).daterangepicker(
        {
          timePicker: true,
          timePicker24Hour: true,
          startDate: moment(),
          endDate: moment().add(1, "days"),
          locale: {
            format: "YYYY-MM-DD HH:mm",
          },
          autoUpdateInput: true,
          opens: "left",
        },
        function (start, end) {
          // Callback on date range selection
          const startFormatted = start.format("YYYY-MM-DD HH:mm");
          const endFormatted = end.format("YYYY-MM-DD HH:mm");

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
    <div className="p-2">
      <label>{label}</label>
      <input
        ref={inputRef}
        type="text"
        className="border px-2 py-1 rounded w-full text-sm font-light"
      />
    </div>
  );
}
