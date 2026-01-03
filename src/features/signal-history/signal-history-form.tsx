"use client";

import { Button, TextInput } from "flowbite-react";
import { useSearchParams } from "next/navigation";
import DateRangePicker from "@/features/common/components/date-picker/date-range-picker";
import moment from "moment";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import MapHistoryView from "./map-history-view";
import { I18nRecord } from "../i18n/i18n.service.types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { tr } from "../i18n/tr.service";
import { usePathname } from "next/navigation";

export default function SignalHistoryForm({ dict }: { dict: I18nRecord }) {
  const searchParams = useSearchParams();

  // Check if all required parameters exist to determine initial state
  const hasLicensePlate = searchParams.get("license_plate");
  const hasStartDate = searchParams.get("start_date");
  const hasEndDate = searchParams.get("end_date");

  // Determine initial state based on available parameters
  let initialState = 0; // Default to license plate input
  if (hasLicensePlate) {
    if (hasStartDate && hasEndDate) {
      initialState = 2; // All parameters present, go to map view
    } else {
      initialState = 1; // Only license plate present, go to date selection
    }
  }

  // Create default date range of 24 hours from now
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const defaultStartDate = now.toISOString().split("T")[0];
  const defaultEndDate = tomorrow.toISOString().split("T")[0];

  const [state, setState] = useState(initialState);
  const router = useRouter();

  const pageStates = [
    LicensePlateInput({
      dict,
      searchParams,
      router,
      next: () => {
        setState(1);
      },
    }),
    DateRangeInput({
      dict,
      searchParams,
      router,
      next: () => setState(2),
      back: () => setState(0),
    }),
    <MapHistoryView
      dict={dict}
      onBackClick={() => {
        // Force rerender by updating state
        setState(1); // Go back to date selection
      }}
    />,
  ];

  return pageStates[state];
}

function LicensePlateInput({
  dict,
  searchParams,
  router,
  next,
}: {
  dict: I18nRecord;
  searchParams: URLSearchParams;
  router: AppRouterInstance;
  next: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleNext = () => {
    const licensePlate = inputRef.current?.value?.trim() || "";

    // Validate license plate is not empty
    if (!licensePlate) {
      setError(tr("signal_historic.license_plate_required", dict));
      return;
    }

    // Clear error if validation passes
    setError("");

    // Update URL with license plate parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set("license_plate", licensePlate);

    router.push(`?${params.toString()}`);
    next();
  };

  return (
    <div className="w-fit h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <h1 className="text-gray-700 dark:text-gray-200 font-bold text-2xl md:text-4xl text-center">
        {tr("signal_historic.signals_historic", dict)}
      </h1>
      <h1 className="text-gray-600 dark:text-gray-400 font-light text-lg mb-4 text-center px-10 md:px-0">
        {tr("signal_historic.enter_license_plate", dict)}
      </h1>
      <div className="w-full max-w-96 h-fit flex flex-col gap-2">
        <div className="w-full h-fit flex flex-col gap-1">
          <TextInput
            ref={inputRef}
            className="w-full"
            id="search"
            placeholder={tr("signal_historic.search", dict)}
            defaultValue={searchParams.get("license_plate") || ""}
            autoComplete="off"
            onChange={() => setError("")} // Clear error on input change
          />
          {error && (
            <span className="text-red-500 text-sm font-medium">{error}</span>
          )}
        </div>
        <Button type="submit" className="w-full" onClick={handleNext}>
          {tr("signal_historic.next", dict)}
        </Button>
      </div>
    </div>
  );
}

function DateRangeInput({
  dict,
  searchParams,
  router,
  next,
  back,
}: {
  dict: I18nRecord;
  searchParams: URLSearchParams;
  router: AppRouterInstance;
  next: () => void;
  back: () => void;
}) {
  const pathname = usePathname(); // Import from 'next/navigation'
  const params = new URLSearchParams(searchParams.toString());

  const handleDateChange = (startDate: string, endDate: string) => {
    // Format dates with local timezone and proper times (00:00 for start, 23:59 for end)
    const formattedStartDate = moment(startDate).startOf("day").format();
    const formattedEndDate = moment(endDate).endOf("day").format();

    // Update URL parameters directly
    params.set("start_date", formattedStartDate);
    params.set("end_date", formattedEndDate);

    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSearch = () => {
    // If no start_date and end_date are set, use yesterday and today with local times
    if (!params.get("start_date") || !params.get("end_date")) {
      const startDate = moment().subtract(1, "day").startOf("day").format();
      const endDate = moment().endOf("day").format();

      params.set("start_date", startDate);
      params.set("end_date", endDate);

      router.replace(`${pathname}?${params.toString()}`);
    }

    next();
  };

  return (
    <div className="w-fit h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <h1 className="text-gray-700 dark:text-gray-200 font-bold text-2xl md:text-4xl text-center">
        {tr("signal_historic.signals_historic", dict)}
      </h1>
      <h1 className="text-gray-600 dark:text-gray-400 font-light text-lg mb-4 text-center px-10 md:px-0">
        {tr("signal_historic.select_date_range", dict)}
      </h1>
      <div className="w-full max-w-96 h-fit flex flex-col gap-2">
        <div className="w-full h-fit flex flex-col gap-1">
          <DateRangePicker
            onDateChange={handleDateChange}
            className="w-full"
            minDate={moment().subtract(1, "year")}
            maxDate={moment()}
            maxRangeDays={1}
            defaultStartDate={
              params.get("start_date")
                ? moment(params.get("start_date")!)
                : moment().subtract(1, "days")
            }
            defaultEndDate={
              params.get("end_date")
                ? moment(params.get("end_date")!)
                : moment()
            }
          />
        </div>
        <div className="flex flex-row gap-2">
          <Button className="w-full" color="alternative" onClick={back}>
            {tr("signal_historic.back", dict)}
          </Button>
          <Button className="w-full" onClick={handleSearch}>
            {tr("signal_historic.search", dict)}
          </Button>
        </div>
      </div>
    </div>
  );
}
