"use client";

import { useState } from "react";
import { FaMapPin, FaTruck } from "react-icons/fa";
import { HiArrowRight, HiChevronUp } from "react-icons/hi";
import { Conditions } from "../table-item.type";
import ConditionIcon from "../condition-icon";
import { Button } from "flowbite-react";
import Link from "next/link";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { BiWorld } from "react-icons/bi";
import { titles } from "@/features/symptoms/types/symptom-titles";
import TagManager from "../tag-manager";
import { GiHealthNormal } from "react-icons/gi";

export default function TimedSymptoms({
  data,
  initial_state = false,
  dict,
  with_top = true,
}: {
  data: SymptomsICUItemResponse;
  initial_state: boolean;
  dict: I18nRecord;
  with_top?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initial_state);
  const item = data;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Expandable Button */}
      {with_top && (
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`flex flex-row gap-2 w-full items-center justify-between transition-all duration-300 hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-800 rounded-t-lg p-2 cursor-pointer border-b border-gray-200 dark:border-gray-700 ${isOpen ? "bg-gray-100 dark:bg-gray-800" : ""}`}
        >
          <div className="flex flex-row gap-2 items-center justify-center">
            <div className="flex flex-row gap-3 items-center text-gray-500 dark:text-gray-400">
              <GiHealthNormal />
              {(dict.symptoms as I18nRecord).conditions_found as string}
            </div>
          </div>
          <HiChevronUp
            className={`w-5 h-5 transition-transform duration-300 ${!isOpen ? "rotate-180" : ""}`}
            color="gray"
          />
        </div>
      )}
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
                tag_style={`${Conditions[item.icu_condition.toLowerCase()].tagColor} ${Conditions[item.icu_condition.toLowerCase()].tagTextColor}`}
                tags={[
                  {
                    text: item.icu_code
                      ? (dict.symptoms as I18nRecord)[
                          titles[item.icu_code.toString() as keyof typeof titles]
                            .title
                        ] as string
                      : "Unknown Symptom",
                  },
                  {
                    text:
                      ((dict.symptoms as I18nRecord).license_plate as string) +
                      ": " +
                      item.asset_id,
                    icon: (
                      <FaTruck
                        className={`${Conditions[item.icu_condition.toLowerCase()].tagTextColor}`}
                      />
                    ),
                  },
                  {
                    text: "Ruta: N/A",
                    icon: (
                      <FaMapPin
                        className={`${Conditions[item.icu_condition.toLowerCase()].tagTextColor}`}
                      />
                    ),
                  },
                  {
                    text: "ID: " + item.trip_id,
                  },
                  {
                    text: item.driver,
                  },
                ]}
              />
            </div>

            {/* End Buttons Section - Fixed Width */}
            <div
              className={`flex-shrink-0 flex flex-row gap-2 align-middle justify-center border-l-2 ${Conditions[item.icu_condition.toLowerCase()].separatorColor} pl-2`}
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
              <Button
                color="blue"
                as={Link}
                href={`/symptoms/map-view/${item.id}?tripId=${item.trip_id}&assetId=${item.asset_id}`}
                className="flex flex-row items-center gap-1 h-8 w-8 rounded-full"
              >
                <HiArrowRight className="text-gray-200" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
