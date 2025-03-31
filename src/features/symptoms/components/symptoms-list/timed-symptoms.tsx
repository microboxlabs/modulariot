"use client";

import { useState } from "react";
import { FaMapPin, FaTruck } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi";
import { Conditions } from "../table-item.type";
import ConditionIcon from "../condition-icon";
import { Button, Tooltip } from "flowbite-react";
import Link from "next/link";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { BiWorld } from "react-icons/bi";
import { titles } from "@/features/symptoms/types/symptom-titles";
import TagManager from "../tag-manager";
import { useTreatmentsGeneral } from "../../hooks/use-treatments-general";
export default function TimedSymptoms({
  data,
  initial_state = false,
  dict,
  _with_top = true,
}: {
  data: SymptomsICUItemResponse;
  initial_state: boolean;
  dict: I18nRecord;
  _with_top?: boolean;
}) {
  const [isOpen] = useState(initial_state);
  const item = data;

  const {
    treatmentData,
    loading,
    error: errorTreatments,
  } = useTreatmentsGeneral(item.id.toString());

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Data */}
      <div
        className={`flex flex-col gap-2 w-full transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1000px] animate-show" : "max-h-0 animate-hide"} z-10`}
      >
        <div
          key={item.symptom_name}
          className="flex flex-col items-center justify-center z-10"
        >
          {/* Condition */}
          <div
            className={`flex flex-row items-center p-2 gap-3 ${Conditions[item.icu_condition.toLowerCase()].textColor} w-full rounded-lg ${Conditions[item.icu_condition.toLowerCase()].bgColor} z-10`}
          >
            {/* Start Condition Section - Fixed Width */}
            <div className="flex flex-row gap-2 flex-shrink-0">
              <div className="flex flex-row items-center gap-1">
                <ConditionIcon
                  condition={item.icu_condition.toLowerCase()}
                  size="h-7 w-7"
                  dict={dict}
                />
                <p>{item.start_time.split("T")[1].slice(0, 8)}</p>
              </div>
            </div>

            {/* Middle Section - Flexible and Shrinkable */}
            <div className="flex align-middle mx-2 gap-1 w-full">
              <TagManager
                tag_style={`bg-transparent ${Conditions[item.icu_condition.toLowerCase()].textColor} ${Conditions[item.icu_condition.toLowerCase()].borderColor ? Conditions[item.icu_condition.toLowerCase()].borderColor : "border-gray-400 dark:border-gray-500"}`}
                tags={[
                  {
                    text: item.icu_code
                      ? ((dict.symptoms as I18nRecord)[
                          titles[
                            item.icu_code.toString() as keyof typeof titles
                          ].title
                        ] as string)
                      : "Unknown Symptom",
                  },
                  {
                    text:
                      ((dict.symptoms as I18nRecord).license_plate as string) +
                      ": " +
                      item.asset_id,
                    icon: (
                      <FaTruck
                        className={`${Conditions[item.icu_condition.toLowerCase()].textColor}`}
                      />
                    ),
                  },
                  {
                    text: loading ? (
                      <div className="text-transparent bg-gray-300 animate-pulse rounded-sm w-40 h-3"></div>
                    ) : errorTreatments ? (
                      <div className="text-transparent bg-gray-300 animate-pulse rounded-sm w-40 h-3"></div>
                    ) : (
                      ((dict.symptoms as I18nRecord).route as string) +
                      ": " +
                      treatmentData?.trip_info?.origin +
                      " - " +
                      treatmentData?.trip_info?.destination
                    ),
                    icon: (
                      <FaMapPin
                        className={`${Conditions[item.icu_condition.toLowerCase()].textColor}`}
                      />
                    ),
                  },
                  {
                    text: "ID: " + item.trip_id,
                  },
                  {
                    text: loading ? (
                      <div className="text-transparent bg-gray-300 animate-pulse rounded-sm w-40 h-3"></div>
                    ) : errorTreatments ? (
                      <div className="text-transparent bg-gray-300 animate-pulse rounded-sm w-40 h-3"></div>
                    ) : (
                      ((dict.symptoms as I18nRecord).transporter as string) +
                      ": " +
                      treatmentData?.trip_info?.carrier
                    ),
                  },
                ]}
              />
            </div>

            {/* End Buttons Section - Fixed Width */}
            <div
              className={`flex-shrink-0 flex flex-row gap-2 align-middle justify-center border-l-2 ${Conditions[item.icu_condition.toLowerCase()].separatorColor} pl-2`}
            >
              <Tooltip
                theme={{
                  arrow: {
                    base: "absolute z-10 h-2 w-2 rotate-45 border-b border-r border-gray-400 dark:border-gray-600",
                    style: {
                      auto: "bg-gray-100 dark:bg-gray-800",
                    },
                  },
                  base: "absolute z-10 inline-block rounded-lg px-3 py-2 text-sm font-medium shadow-sm border border-gray-400 dark:border-gray-600",
                  style: {
                    auto: "bg-gray-100 dark:bg-gray-800",
                  },
                }}
                style="auto"
                content={
                  <div className="flex flex-col gap-1">
                    <p>
                      {(dict.symptoms as I18nRecord).geographic_view as string}
                    </p>
                  </div>
                }
              >
                <Button
                  as={Link}
                  href="/geographic-view"
                  className={`flex flex-row items-center gap-1 h-8 w-8 rounded-full border-2 ${Conditions[item.icu_condition.toLowerCase()].secundaryInteraction}`}
                >
                  <BiWorld
                    size={20}
                    className={`${Conditions[item.icu_condition.toLowerCase()].secundaryInteractionIcon}`}
                  />
                </Button>
              </Tooltip>
              <Tooltip
                theme={{
                  arrow: {
                    base: "absolute z-10 h-2 w-2 rotate-45 border-b border-r border-gray-400 dark:border-gray-600",
                    style: {
                      auto: "bg-gray-100 dark:bg-gray-800",
                    },
                  },
                  base: "absolute z-10 inline-block rounded-lg px-3 py-2 text-sm font-medium shadow-sm border border-gray-400 dark:border-gray-600",
                  style: {
                    auto: "bg-gray-100 dark:bg-gray-800",
                  },
                }}
                style="auto"
                content={
                  <div className="flex flex-col gap-1">
                    <p>
                      {(dict.symptoms as I18nRecord).go_to_treatment as string}
                    </p>
                  </div>
                }
              >
                <Button
                  color="blue"
                  as={Link}
                  href={`/symptoms/map-view/${item.id}?tripId=${item.trip_id}&assetId=${item.asset_id}`}
                  className="flex flex-row items-center gap-1 h-8 w-8 rounded-full"
                >
                  <HiArrowRight className="text-gray-200" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
