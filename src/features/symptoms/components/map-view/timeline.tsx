import {
  TreatmentsTimelineResponse,
  TreatmentsGeneralResponseItem,
} from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "../condition-icon";
import {
  TimelineElement,
  TimelineItem,
} from "@/features/symptoms/types/timeline";
import { useState } from "react";
import SymptomIcon from "../symtom-icon";
import TagManager from "../tag-manager";
//import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import phoneIcon from "@assets/timeline/phone.svg";
import messageIcon from "@assets/timeline/message-dots.svg";
import Image from "next/image";

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

/* function calculateDuration(
  startTime: string,
  dict: I18nRecord,
  lang: string,
): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffInMs = now.getTime() - start.getTime();

  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  let duration = "";

  if (diffInMinutes < 60) {
    duration = `${diffInMinutes} ${(dict.symptoms as I18nRecord).minutes as string}`;
  } else if (diffInHours < 24) {
    duration = `${diffInHours} ${(dict.symptoms as I18nRecord).hours as string}`;
  } else {
    duration = `${diffInDays} ${(dict.symptoms as I18nRecord).days as string}`;
  }

  if (lang === "es") {
    duration = (dict.symptoms as I18nRecord).ago + " " + duration;
  } else if (lang === "en") {
    duration = duration + " " + (dict.symptoms as I18nRecord).ago;
  }

  return duration;
} */

function formatLongEmails(emails: string) {
  const emailSize = 15;
  if (emails.length < emailSize) {
    return emails;
  }

  return emails.slice(0, emailSize) + "...";
}

function TimelineGroup({
  item,
  isExpanded,
  onToggle,
  dict,
  lang,
  date,
  treatmentData,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
}: {
  item: TimelineElement;
  isExpanded: boolean;
  onToggle: () => void;
  dict: I18nRecord;
  lang: string;
  date: string;
  treatmentData: TreatmentsGeneralResponseItem;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (
    treatmentIndex: TreatmentsTimelineResponse,
  ) => void;
}) {
  // Get unique tags from all items
  const allTags = new Set(
    item.items.flatMap((subItem) => {
      const tags = [];
      if (subItem.type) tags.push(subItem.type);
      return tags;
    }),
  );

  // Get unique conditions
  const uniqueConditions = new Set(
    item.items.map((subItem) => subItem.icu_condition),
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      {/* Header - Always visible */}
      <div
        className="p-2 cursor-pointer flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <SymptomIcon type={item.items[0].type} size="h-8 w-8" dict={dict} />
          <div>
            <p className="text-xs font-medium text-gray-500 leading-3">
              {/* {new Date(item.items[0].start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })} */}
              {formatDate(new Date(date), lang)}
            </p>
            <p className="text-xs font-medium text-gray-900 dark:text-white leading-none">
              {((dict.symptoms as I18nRecord)[item.items[0].type] as string) ??
                item.items[0].type}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2"></div>
        <div className="flex items-center gap-4">
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2.5 py-0.5 rounded flex items-center gap-2">
            <Image
              src={messageIcon}
              alt="Call driver"
              width={10}
              height={10}
              className="w-4 h-4"
            />
            {
              item.items.filter(
                (subItem) =>
                  (subItem.type === "CORREO ELECTRONICO" ||
                    subItem.type === "MENSAJE KAUSANA") &&
                  subItem.assigned_to,
              ).length
            }
          </span>
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2.5 py-0.5 rounded flex items-center gap-2">
            <Image
              src={phoneIcon}
              alt="Call driver"
              width={10}
              height={10}
              className="w-4 h-4"
            />
            {
              item.items.filter(
                (subItem) =>
                  subItem.type === "LLAMAR AL CONDUCTOR" && subItem.assigned_to,
              ).length
            }
          </span>
          {!isExpanded && (
            /* animation to appear slowly */
            <div className="flex -space-x-2.5">
              {Array.from(uniqueConditions).map((condition, index) => (
                <ConditionIcon
                  key={index}
                  condition={condition}
                  size="h-6 w-6"
                  dict={dict}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary - Visible when collapsed */}
      {!isExpanded && (
        <div className="px-2 pb-2">
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
          {/*  <div className="flex flex-wrap gap-2 mt-2">
            {Array.from(allTags).map((tag, index) => (
              <span
                key={index}
                className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs px-2.5 py-0.5 rounded"
              >
                {((dict.symptoms as I18nRecord)[tag] as string) ?? tag}
              </span>
            ))}
          </div> */}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {item.items.map((subItem, subIndex) => (
            <div
              key={subIndex}
              className={`p-2 cursor-pointer flex flex-row gap-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-md rounded-md transition-all duration-200 cursor-pointer ${
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
              {/* <div className="flex items-center gap-3">
                <ConditionIcon
                  condition={subItem.icu_condition}
                  size="h-5 w-5"
                  dict={dict}
                />
                <div className="flex-grow">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {((dict.symptoms as I18nRecord)[
                      subItem.description
                    ] as string) ?? subItem.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(subItem.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {subItem.assigned_to && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    {subItem.assigned_to}
                  </span>
                )}
              </div> */}
              <div className="flex flex-col">
                <ConditionIcon
                  condition={subItem?.icu_condition}
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
                  {subItem.assigned_to && (
                    <p className="flex flex-row flex-grow justify-end">
                      <small className="bg-blue-200 rounded-md px-2  py-1 text-gray-600 flex items-center text-xs">
                        {formatLongEmails(
                          ((dict.symptoms as I18nRecord)[
                            subItem.assigned_to
                          ] as string) ?? subItem.assigned_to,
                        )}
                      </small>
                    </p>
                  )}
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    {((dict.symptoms as I18nRecord)[subItem.type] as string) ??
                      subItem.type}
                  </p>
                  <p className="text-xs font-light text-gray-900 dark:text-gray-200">
                    {((dict.symptoms as I18nRecord)[
                      subItem.description
                    ] as string) ?? subItem.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TimelineComponent({
  lang,
  dict,
  treatmentData,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
}: {
  lang: string;
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (
    treatmentIndex: TreatmentsTimelineResponse,
  ) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (date: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const groupedTimeline: Record<string, TimelineElement> =
    treatmentData && treatmentData?.timeline?.length > 0
      ? treatmentData?.timeline.reduce(
          (acc: Record<string, TimelineElement>, event: TimelineItem) => {
            const date = new Date(event.start).toISOString().split("T")[0];

            if (!acc[date]) {
              acc[date] = {
                date,
                assigned_to: "N/A",
                items: [],
              };
            }

            acc[date].items.push({
              start: event.start,
              end: event.end,
              icu_condition: event.icu_condition.toLowerCase(),
              description: event.description,
              type: event.type.toUpperCase(),
              assigned_to: event.assigned_to,
              icu_code: event.icu_code,
              is_symptom: event.is_symptom,
              symptom_id: event.symptom_id,
            });

            return acc;
          },
          {} as Record<string, TimelineElement>,
        )
      : {};

  const timelineData = Object.entries(groupedTimeline).sort(
    ([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime(),
  );

  return (
    <div className="flex flex-col gap-4 bg-gray-50 dark:bg-gray-800 rounded-md p-4">
      {timelineData.map(([date, item]) => (
        <div key={date} className="flex flex-col gap-2">
          {/* <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(new Date(date), lang)}
            </h2>
            {date === new Date().toISOString().split("T")[0] && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {(dict.symptoms as I18nRecord).today as string}
              </span>
            )}
          </div> */}
          {treatmentData && (
            <TimelineGroup
              item={item}
              isExpanded={expandedGroups.has(date)}
              onToggle={() => toggleGroup(date)}
              dict={dict}
              lang={lang}
              date={date}
              treatmentData={treatmentData}
              setSelectedTreatment={setSelectedTreatment}
              setSelectedTreatmentIndex={setSelectedTreatmentIndex}
            />
          )}
        </div>
      ))}
    </div>
  );
}
