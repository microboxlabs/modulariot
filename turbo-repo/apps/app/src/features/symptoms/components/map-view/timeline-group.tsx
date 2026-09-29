import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import ConditionIcon from "../condition-icon";
import {
  TimelineElement,
  ConditionsAgg,
} from "@/features/symptoms/types/timeline";
import SymptomIcon from "../symtom-icon";
import phoneIcon from "@assets/timeline/phone.svg";
import messageIcon from "@assets/timeline/message-dots.svg";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FormattedDate } from "@/features/common/components/formatted-date";
import TreatmentsTimelineBox, { useHasTreatments } from "./treatments-timeline-box";

/**
 * The connecting line plus the symptom's treatments, under a timeline node.
 * Skipped entirely when the symptom has no recorded treatment, so a bare
 * condition change stays as small as its icon+time row alone.
 */
function SymptomTreatmentsBranch({
  dict,
  symptomId,
}: Readonly<{ dict: I18nRecord; symptomId: number | null }>) {
  const hasTreatments = useHasTreatments(symptomId);
  if (!hasTreatments) return null;
  return (
    <div className="flex flex-1 flex-row gap-1">
      <div className="flex w-5 shrink-0 flex-col items-center">
        <div className="mt-1 w-0.5 grow bg-gray-300 dark:bg-gray-600" />
      </div>
      <div className="flex w-full flex-col gap-1 pt-2 pb-2">
        <TreatmentsTimelineBox dict={dict} symptomId={symptomId} />
      </div>
    </div>
  );
}

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

  useEffect(() => {
    if (
      item.conditions_agg?.some(
        (subItem) => subItem.symptom_id == treatmentData.symptom_info?.id
      )
    ) {
      setIsExpanded(true);
    }
  }, [item, treatmentData.symptom_info?.id]);

  useEffect(() => {
    if (selectedItemRef.current) {
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [isExpanded, item.conditions_agg]);

  // Get unique conditions
  const uniqueConditions = new Set(
    item.conditions_agg?.map((subItem) => subItem.icu_condition?.toLowerCase())
  );

  /* const start_hour = new Date(
    item.conditions_agg?.[0]?.start ?? ""
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); */

  const longest_treatment = item.conditions_agg?.reduce((max, subItem) => {
    return Math.max(
      max,
      Math.floor(
        (new Date(subItem?.end ?? "").getTime() -
          new Date(subItem?.start ?? "").getTime()) /
          60000
      )
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
                {/* {start_hour} */}
                <FormattedDate
                  date={item.conditions_agg?.[0]?.start}
                  format="time"
                />{" "}
                | {Math.floor(length_text_value)} {length_text}
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
                              "MENSAJE KAUSANA"
                        ).length
                      : 0),
                  0
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
                            "LLAMAR AL CONDUCTOR"
                        ).length
                      : 0),
                  0
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content — the symptom name already shows in the
          always-visible header above, so it isn't repeated here. Just a
          real timeline running down the left: icon + connecting line, with
          each node's own time, duration and treatments (assigned_to folded
          into the treatments box) to its right. */}
      <div
        className={`border-t border-gray-100 dark:border-gray-800 transition-all duration-200 flex-col ${
          isExpanded
            ? "animate-show-flex-middle"
            : "animate-hide-flex-middle min-h-0"
        }`}
      >
        {isExpanded && item.conditions_agg && item.conditions_agg.length > 0 && (
          <div className="flex flex-col">
            {typeof item.conditions_agg[0].symptom_description === "string" && (
              <>
                <p className="p-2 text-xs font-light text-gray-900 dark:text-gray-200">
                  {((dict.symptoms as I18nRecord)[
                    item.conditions_agg[0].symptom_description
                  ] as string) ?? item.conditions_agg[0].symptom_description}
                </p>
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
              </>
            )}

            <div className="flex flex-col gap-1">
              {item.conditions_agg.map((subItem, subIndex) => {
                const isSelected =
                  subItem.symptom_id == treatmentData.symptom_info?.id;
                const durationMin =
                  subItem.start && subItem.end
                    ? Math.floor(
                        (new Date(subItem.end).getTime() -
                          new Date(subItem.start).getTime()) /
                          60000
                      )
                    : null;
                return (
                  <div
                    key={subIndex}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => {
                      setSelectedTreatment(treatmentData);
                      setSelectedTreatmentIndex(subItem);
                    }}
                    className={`flex cursor-pointer flex-col p-2 rounded-b-md transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      subItem.treatments.length > 0 ? "min-h-10" : ""
                    } ${isSelected ? "border border-amber-300" : ""} ${
                      subItem.is_symptom == 0 ||
                      subItem.type == "EVENTS END" ||
                      subItem.type == "TRIP_START"
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    {/* Icon and the hour/duration text centered against
                        each other — the icon anchors the vertical position,
                        the text centers on it, regardless of either one's
                        own height. */}
                    <div className="flex flex-row items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <ConditionIcon
                            condition={subItem?.icu_condition?.toLowerCase() ?? ""}
                            size="h-5 w-5"
                            dict={dict}
                          />
                        </div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          <FormattedDate date={subItem.start} format="time" />
                          {durationMin !== null && <> | {durationMin} min</>}
                        </p>
                      </div>
                      {subItem.assigned_to && (
                        <small className="flex shrink-0 items-center rounded-md bg-blue-200 px-2 text-[10px]">
                          {((dict.symptoms as I18nRecord)[
                            subItem.assigned_to
                          ] as string) ?? subItem.assigned_to}
                        </small>
                      )}
                    </div>

                    {/* Second row: the connecting line (under the icon,
                        same column width) and the rest of the content
                        (under the text). A small gap off the icon, then
                        straight down to touch the row's own bottom edge,
                        flowing directly into the next node's icon. Skipped
                        entirely — no line, no padding — when there's no
                        treatment to show, so a bare condition change stays
                        as small as its icon+time row alone. */}
                    <SymptomTreatmentsBranch
                      dict={dict}
                      symptomId={subItem.symptom_id}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
