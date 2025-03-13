"use client";

import ConditionIcon from "../condition-icon";
import ExpandableButton from "../expandable-button";
import { Conditions } from "../table-item.type";
import { FaClock, FaTruck } from "react-icons/fa";
import { Spinner } from "flowbite-react";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { FaUser } from "react-icons/fa6";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

function formatDate(date: Date, lang: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", options)
    .format(date)
    .toUpperCase()
    .replace(".", "");
}

function calculateDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffInMs = now.getTime() - start.getTime();

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} min`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hr${diffInHours > 1 ? "s" : ""}`;
  } else {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""}`;
  }
}

export default function SideInfoData({
  dict,
  lang,
  treatmentData,
  loading,
  error,
}: {
  dict: I18nRecord;
  lang: string;
  treatmentData: TreatmentsGeneralResponseItem | null;
  loading: boolean;
  error: Error | null;
}) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !treatmentData) {
    return (
      <div className="text-red-500 text-center p-4">
        {error?.message || "No treatment data available"}
      </div>
    );
  }

  // For timeline display, we need to group by date and format appropriately
  const groupedTimeline =
    treatmentData?.timeline?.length > 0
      ? treatmentData?.timeline.reduce(
          (acc, event) => {
            const date = new Date(event.start).toISOString().split("T")[0];

            if (!acc[date]) {
              acc[date] = {
                date,
                assigned_to: "N/A", // This might need to come from the API
                items: [],
              };
            }

            acc[date].items.push({
              start: event.start,
              end: event.end, // The API doesn't provide end time
              condition: event.type.toLowerCase().includes("critical")
                ? "critic"
                : event.type.toLowerCase().includes("black")
                  ? "code black"
                  : "stable",
              description: event.description,
              type: event.type,
            });

            return acc;
          },
          {} as Record<string, any>,
        )
      : [];

  const timelineData = Object.values(groupedTimeline);

  return (
    <div className="flex flex-col gap-2 w-full  overflow-y-auto">
      hola
      <ExpandableButton
        initial_state={true}
        icon={<FaTruck />}
        title={(dict.symptoms as I18nRecord).condition as string}
        description={
          (dict.symptoms as I18nRecord).relevant_information as string
        }
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex flex-row items-center gap-2 p-1 rounded-md ${
              Conditions["code black"].bgColor
            }`}
          >
            <ConditionIcon condition="code black" size="h-7 w-7" />
            <p
              className={`text-sm font-medium ${
                Conditions["code black"].textColor
              }`}
            >
              {new Date().toLocaleString().split(",")[1]}
              <span className="text-gray-400 text-xs">
                {" "}
                {treatmentData?.trip_info?.trip_id}
              </span>
            </p>
          </div>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).observed_symptom as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.symptom_info?.name}
            </span>
          </p>
          {/* <p className="text-sm">
            {dict.symptoms.event}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.symptom_info.type}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.trip}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.trip_id}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.driver}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.driver}
            </span>
          </p>
          <p className="text-sm">
            {dict.symptoms.client}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData.trip_info.carrier}
            </span>
          </p> */}
        </div>
      </ExpandableButton>
      <ExpandableButton
        initial_state={true}
        icon={<FaUser />}
        title={(dict.symptoms as I18nRecord).service as string}
        description={(dict.symptoms as I18nRecord).driver_description as string}
      >
        <div className="flex flex-col gap-2">
          <div
            className={`flex flex-row items-center gap-2 p-1 rounded-md ${
              Conditions["code black"].bgColor
            }`}
          >
            <ConditionIcon condition="code black" size="h-7 w-7" />
            <p
              className={`text-sm font-medium ${
                Conditions["code black"].textColor
              }`}
            >
              {new Date().toLocaleString().split(",")[1]}
              <span className="text-gray-400 text-xs">
                {" "}
                {treatmentData?.trip_info?.trip_id}
              </span>
            </p>
          </div>
          <p className="text-sm">
            ID:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.trip_id}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).active as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.asset_id}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).route as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.origin} -{" "}
              {treatmentData?.trip_info?.destination}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).transporter as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.carrier}
            </span>
          </p>
          <p className="text-sm">
            {(dict.symptoms as I18nRecord).driver as string}:{" "}
            <span className="text-gray-500 dark:text-gray-400">
              {treatmentData?.trip_info?.driver}
            </span>
          </p>
        </div>
      </ExpandableButton>
      {/* Timeline section - show only if we have timeline data */}
      {timelineData.length > 0 && (
        <ExpandableButton
          icon={<FaClock />}
          title={(dict.symptoms as I18nRecord).timeline as string}
          description={
            (dict.symptoms as I18nRecord).timeline_description as string
          }
        >
          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
            {timelineData.map((item, index) => {
              const date = formatDate(new Date(item.date), lang);
              const duration = calculateDuration(
                item.items[item.items.length - 1].start,
              );

              return (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
                    <div className="w-full flex flex-row gap-5 text-sm items-center justify-between px-2">
                      <div className="text-black dark:text-white">{date}</div>
                      <div className="flex flex-row flex-grow justify-between">
                        <p className="bg-blue-200 rounded-md px-2 py-1 text-gray-600 flex items-center">
                          {item.assigned_to}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 flex align-middle items-center">
                          {duration}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 bg">
                    {item.items.map((subItem: any, subIndex: any) => (
                      <div key={subIndex} className="flex flex-row gap-2">
                        <div className="flex flex-col">
                          <ConditionIcon
                            condition={subItem.condition}
                            size="h-7 w-7"
                          />
                          <div className="w-[2px] mt-1 mx-auto bg-gray-400 flex-grow" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {new Date(subItem.start).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            |{" "}
                            {new Date(subItem.end).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                            {subItem.type}
                          </p>
                          <p className="text-sm font-light text-gray-900 dark:text-gray-200">
                            {subItem.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableButton>
      )}
    </div>
  );
}
