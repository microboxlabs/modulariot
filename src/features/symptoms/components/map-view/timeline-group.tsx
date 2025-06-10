import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "../condition-icon";
import {
  TimelineElement,
  ConditionsAgg,
} from "@/features/symptoms/types/timeline";
import SymptomIcon from "../symtom-icon";
import TagManager from "../tag-manager";
import phoneIcon from "@assets/timeline/phone.svg";
import messageIcon from "@assets/timeline/message-dots.svg";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "flowbite-react";
import { FaImages } from "react-icons/fa";

/*
function formatDate(date: Date, lang: string): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };

  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-US", options)
    .format(date)
    .toUpperCase()
    .replace(".", "")
    .replace(",", "");
}
*/

function formatLongEmails(emails: string) {
  const emailSize = 15;
  if (emails.length < emailSize) {
    return emails;
  }

  return emails.slice(0, emailSize) + "...";
}

export default function TimelineGroup({
  item,
  dict,
  treatmentData,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
}: {
  item: TimelineElement;
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (treatmentIndex: ConditionsAgg) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Get unique tags from all items
  const allTags = new Set(
    item.conditions_agg?.flatMap((subItem) => {
      const tags = [];
      if (subItem.type) tags.push(subItem.type);
      return tags;
    }) ?? [],
  );

  useEffect(() => {
    if (
      item.conditions_agg?.some(
        (subItem) => subItem.symptom_id == treatmentData.symptom_info?.id,
      )
    ) {
      setIsExpanded(true);
    }
  }, [item]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedItemRef.current]);

  // Get unique conditions
  const uniqueConditions = new Set(
    item.conditions_agg?.map((subItem) => subItem.icu_condition?.toLowerCase()),
  );

  const start_hour = new Date(
    item.conditions_agg?.[0]?.start ?? "",
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const longest_treatment = item.conditions_agg?.reduce((max, subItem) => {
    return Math.max(
      max,
      Math.floor(
        (new Date(subItem?.end ?? "").getTime() -
          new Date(subItem?.start ?? "").getTime()) /
          60000,
      ),
    );
  }, 0);
  // Get the length in minutes
  const length = longest_treatment ?? 0;
  /* const length = Math.floor(
    (new Date(item.conditions_agg?.[0]?.end ?? "").getTime() -
      new Date(item.conditions_agg?.[0]?.start ?? "").getTime()) /
      60000,
  ); */

  // add to this the transformed value of length
  const length_text =
    length > 60 ? (length > 1440 ? (length > 86400 ? "d" : "h") : "h") : "m";
  const length_text_value =
    length > 60
      ? length > 1440
        ? length > 86400
          ? length / 86400
          : length / 1440
        : length / 60
      : length;
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-colors duration-200 border hover:bg-gray-100 dark:hover:bg-gray-900 hover:border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700">
      <div
        className="flex flex-col cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header - Always visible */}
        <div className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SymptomIcon
              type={item.conditions_agg?.[0]?.type ?? ""}
              size="h-6 w-6"
              dict={dict}
            />
            <div className="flex flex-col gap-[2px]">
              <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">
                {((dict.symptoms as I18nRecord)[
                  item.conditions_agg?.[0]?.type ?? ""
                ] as string) ??
                  item.conditions_agg?.[0]?.type ??
                  ""}
              </p>
              <p className="text-xs font-light text-gray-500 leading-3">
                {start_hour} | {Math.floor(length_text_value)} {length_text}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2"></div>
          <div className="flex items-center gap-2">
            <div
              className={`flex -space-x-2.5 transition-all duration-[0.5s] ${
                isExpanded ? "animate-hide-flex" : "animate-show-flex"
              }`}
            >
              {Array.from(uniqueConditions).map((condition, index) => (
                <ConditionIcon
                  key={index}
                  condition={condition ?? ""}
                  size="h-6 w-6"
                  dict={dict}
                />
              ))}
            </div>
            <div className="flex flex-row gap-1">
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2.5 py-0.5 rounded flex items-center gap-1">
                <Image
                  src={messageIcon}
                  alt="Call driver"
                  width={10}
                  height={10}
                  className="w-4 h-4"
                />
                {item.conditions_agg?.reduce(
                  (acc, subItem) =>
                    acc +
                    (subItem.treatments.length > 0
                      ? subItem.treatments.filter(
                          (treatment) =>
                            treatment.treatment_type.toUpperCase() ===
                              "CORREO ELECTRONICO" ||
                            treatment.treatment_type.toUpperCase() ===
                              "MENSAJE KAUSANA",
                        ).length
                      : 0),
                  0,
                )}
              </span>
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2.5 py-0.5 rounded flex items-center gap-1">
                <Image
                  src={phoneIcon}
                  alt="Call driver"
                  width={10}
                  height={10}
                  className="w-4 h-4"
                />
                {item.conditions_agg?.reduce(
                  (acc, subItem) =>
                    acc +
                    (subItem.treatments.length > 0
                      ? subItem.treatments.filter(
                          (treatment) =>
                            treatment.treatment_type.toUpperCase() ===
                            "LLAMAR AL CONDUCTOR",
                        ).length
                      : 0),
                  0,
                )}
              </span>
            </div>
          </div>
        </div>
        {/* Summary - Visible when collapsed */}
        <div
          className={`px-2 pb-2 transition-all duration-200 ${
            isExpanded ? "animate-hide-flex-middle" : "animate-show-flex-middle"
          }`}
        >
          <div className="flex align-middle gap-1 flex-grow">
            <TagManager
              tag_style="bg-transparent border-gray-300 dark:border-gray-500 dark:text-white"
              tags={Array.from(allTags).map((tag) => {
                return {
                  text: ((dict.symptoms as I18nRecord)[tag] as string) ?? tag,
                };
              })}
            />
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <div
        className={`border-t border-gray-100 dark:border-gray-800 transition-all duration-200 flex-col ${
          isExpanded ? "animate-show-flex-middle" : "animate-hide-flex-middle"
        }`}
      >
        {item.conditions_agg?.map((subItem, subIndex) => {
          const isSelected =
            subItem.symptom_id == treatmentData.symptom_info?.id;
          return (
            <div
              key={subIndex}
              ref={isSelected ? selectedItemRef : null}
              className={`p-2 cursor-pointer flex flex-row gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-md last:rounded-b-md transition-all duration-200  ${isSelected ? "border rounded-md border-amber-300" : ""} ${
                subItem.is_symptom == 0 ||
                subItem.type == "EVENTS END" ||
                subItem.type == "TRIP_START"
                  ? "opacity-50 rounded-md"
                  : ""
              }`}
              onClick={() => {
                setSelectedTreatment(treatmentData);
                setSelectedTreatmentIndex(subItem);
              }}
            >
              <div className="flex flex-col">
                <ConditionIcon
                  condition={subItem?.icu_condition?.toLowerCase() ?? ""}
                  size="h-5 w-5"
                  dict={dict}
                />
                <div className="w-[2px] mt-1 mx-auto bg-gray-400 flex-grow" />
              </div>
              <div className="flex flex-col w-full">
                <div className="flex flex-row justify-between">
                  <p className="h-7 text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center">
                    {new Date(subItem.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {/* {new Date(subItem.end).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} */}
                    |{" "}
                    {subItem.start && subItem.end && (
                      <>
                        {/* difference between start and end in minutes */}
                        {Math.floor(
                          (new Date(subItem.end).getTime() -
                            new Date(subItem.start).getTime()) /
                            60000,
                        )}
                      </>
                    )}{" "}
                    min
                  </p>
                  <div className="flex flex-row flex-grow justify-end gap-1">
                    {subItem.evidences && subItem.evidences?.length > 0 && (
                      <small className="bg-gray-100 dark:bg-gray-800 rounded-md px-2 flex items-center text-xs gap-1">
                        <FaImages
                          className="text-gray-600 dark:text-gray-400"
                          size={15}
                        />
                        <p className="text-gray-800 dark:text-gray-200">
                          {
                            JSON.parse(subItem.evidences as unknown as string)
                              .length
                          }
                        </p>
                      </small>
                    )}
                    {subItem.assigned_to && (
                      <small className="bg-blue-200 rounded-md px-2 flex items-center text-xs">
                        {formatLongEmails(
                          ((dict.symptoms as I18nRecord)[
                            subItem.assigned_to
                          ] as string) ?? subItem.assigned_to,
                        )}
                      </small>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {((dict.symptoms as I18nRecord)[subItem.type] as string) ??
                      subItem.type}
                  </p>
                  <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                    {((dict.symptoms as I18nRecord)[
                      subItem.symptom_description
                    ] as string) ?? subItem.symptom_description}
                  </p>
                  {subItem.treatments.length > 0 && (
                    <div className="mt-2 text-xs font-light bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-md p-1 ">
                      <p className="font-medium">
                        {(dict.symptoms as I18nRecord).treatments as string}:
                      </p>
                      {subItem.treatments.map((treatment, index) => (
                        <Tooltip
                          key={index}
                          style="auto"
                          content={
                            <div className="text-xs">
                              <p className="font-medium">
                                {
                                  (dict.symptoms as I18nRecord)
                                    .message as string
                                }
                                :{" "}
                                <span className="font-light">
                                  {treatment.description.message}
                                </span>
                              </p>

                              {treatment.description.driver_response && (
                                <>
                                  <hr className="my-2 border-gray-200 dark:border-gray-700" />
                                  <p className="font-medium">
                                    {
                                      (dict.symptoms as I18nRecord)
                                        .response as string
                                    }
                                    :{" "}
                                    <span className="font-light">
                                      {treatment.description.driver_response}
                                    </span>
                                  </p>
                                </>
                              )}
                            </div>
                          }
                          placement="top"
                        >
                          <p className="hover:underline">
                            -{" "}
                            {((dict.symptoms as I18nRecord)[
                              treatment.treatment_type.toUpperCase()
                            ] as string) ?? treatment.treatment_type}
                          </p>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
