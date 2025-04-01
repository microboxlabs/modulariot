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
    .replace(".", "");
}

function calculateDuration(
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
  const groupedTimeline: Record<string, TimelineElement> =
    treatmentData && treatmentData?.timeline?.length > 0
      ? treatmentData?.timeline.reduce(
          (acc: Record<string, TimelineElement>, event: TimelineItem) => {
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
              end: event.end,
              icu_condition: event.icu_condition.toLowerCase(),
              description: event.description,
              type: event.type.toUpperCase(),
              assigned_to: event.assigned_to,
              icu_code: event.icu_code,
              is_symptom: event.is_symptom,
            });

            return acc;
          },
          {} as Record<string, TimelineElement>,
        )
      : {};

  const timelineData: TimelineElement[] = Object.values(groupedTimeline);

  return (
    <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-md p-1">
      {timelineData.reverse().map((item: TimelineElement, index: number) => {
        const date = formatDate(new Date(item.date), lang);
        const isToday = item.date === new Date().toISOString().split("T")[0];
        const duration = calculateDuration(item.items[0].start, dict, lang);

        return (
          <div
            key={index}
            className={`flex flex-col gap-2 ${
              index != timelineData.length - 1 ? "pb-2" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="flex flex-col bg-gray-100 dark:bg-gray-900 rounded-lg p-1 text-xs">
              <div className="w-full flex flex-row gap-5 items-center justify-between px-2">
                <div className="text-black dark:text-white text-sm">{date}</div>
                <div className="flex flex-row flex-grow justify-between">
                  {isToday ? (
                    <p className="bg-blue-200 rounded-md px-2  py-1 text-gray-600 flex items-center">
                      {(dict.symptoms as I18nRecord).today as string}
                    </p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 flex align-middle items-center"></p>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 flex align-middle items-center">
                    {duration}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 bg">
              {item.items
                .reverse()
                .map((subItem: TimelineItem, subIndex: number) => (
                  <div
                    key={subIndex}
                    className={`flex flex-row gap-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-md rounded-md transition-all duration-200 cursor-pointer ${
                      subItem.is_symptom == 0 ||
                      subItem.type == "EVENTS END" ||
                      subItem.type == "TRIP_START"
                        ? "opacity-50 rounded-md"
                        : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        subItem.is_symptom == 0 ||
                        subItem.type == "EVENTS END" ||
                        subItem.type == "TRIP_START"
                      ) {
                        return;
                      }
                      if (treatmentData) {
                        setSelectedTreatment(treatmentData);
                        setSelectedTreatmentIndex(subItem);
                      }
                    }}
                  >
                    <div className="flex flex-col">
                      <ConditionIcon
                        condition={subItem?.icu_condition}
                        size="h-7 w-7"
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
                          |{" "}
                          {new Date(subItem.end).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {subItem.assigned_to && (
                          <p className="flex flex-row flex-grow justify-end">
                            <small className="bg-blue-200 rounded-md px-2  py-1 text-gray-600 flex items-center text-xs">
                              {((dict.symptoms as I18nRecord)[
                                subItem.assigned_to
                              ] as string) ?? subItem.assigned_to}
                            </small>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {((dict.symptoms as I18nRecord)[
                            subItem.type
                          ] as string) ?? subItem.type}
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
          </div>
        );
      })}
    </div>
  );
}
