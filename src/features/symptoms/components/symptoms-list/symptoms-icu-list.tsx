"use client";

import { Card } from "flowbite-react";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import SymptomsData from "@/features/symptoms/components/symptoms-list/symptoms-data";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import maskImage from "@assets/images/mask.gif";
import SymptomsListSkeleton from "./symptoms-list-skeleton";
import { useSymptomsIcu } from "@/features/common/providers/client-api.provider";
import patchImage from "@assets/images/patch.gif";

interface SymptomsIcuListProps {
  condition: string;
  dict: I18nRecord;
  lang: string;
}

const titles = {
  "0": {
    base: "restablished_symptoms",
    title: "stable",
    icon: patchImage,
  },
  "1": {
    base: "restablished_symptoms",
    title: "in_observation",
    icon: maskImage,
  },
  "3": {
    base: "urgent_symptoms",
    title: "critical_condition",
    icon: noAlarmImage,
  },
  "4": {
    base: "urgent_symptoms",
    title: "code_black",
    icon: noAlarmImage,
  },
  "6": {
    base: "symptoms_being_treated",
    title: "in_treatment",
    icon: maskImage,
  },
  "8": {
    base: "symptoms_being_treated",
    title: "in_remission",
    icon: patchImage,
  },
};

export default function SymptomsIcuList({
  condition,
  dict,
  lang,
}: SymptomsIcuListProps) {
  const { icuData, isLoading, error } = useSymptomsIcu(condition);

  if (isLoading) {
    return <SymptomsListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-red-500 text-center my-8">
        Failed to load ICU data: {error.message}
      </div>
    );
  }

  if (icuData.length === 0) {
    return (
      <div className="text-center my-8 text-gray-500">
        No ICU data available for this condition
      </div>
    );
  }

  // Group data by date (extracting date from start_time)
  const groupedByDate =
    icuData.length > 0
      ? icuData.reduce(
          (
            groups: Record<string, SymptomsICUItemResponse[]>,
            item: SymptomsICUItemResponse,
          ) => {
            // Extract date part from start_time (assuming ISO format)
            const date = new Date(item.start_time).toLocaleDateString(lang);

            // Create group if it doesn't exist
            if (!groups[date]) {
              groups[date] = [];
            }

            // Add item to group
            groups[date].push(item);
            return groups;
          },
          {},
        )
      : {};

  const this_title = titles[condition as keyof typeof titles];

  return (
    <>
      {icuData.length > 0 ? (
        <>
          <div
            className={`mx-5 mb-5 relative flex flex-col gap-10 ${
              ["3", "4"].includes(condition) ? "animate-shadow-toggle" : ""
            } rounded-lg overflow-visible`}
          >
            <Card
              className="flex flex-row"
              color="white"
              theme={{
                root: {
                  children: "p-2",
                },
              }}
            >
              <div className="flex flex-row gap-2 items-center justify-center">
                <Image
                  className="w-[50px] h-[50px]"
                  src={this_title.icon}
                  alt="Síntomas Urgentes"
                  width={50}
                  height={50}
                />
                <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {
                    (dict.symptoms as I18nRecord)[
                      this_title.base as keyof I18nRecord
                    ] as string
                  }
                  :{" "}
                  {
                    (dict.symptoms as I18nRecord)[
                      this_title.title as keyof I18nRecord
                    ] as string
                  }
                </h1>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 mx-5 overflow-y-auto">
            {Object.entries(groupedByDate).map(([date, items]) => (
              <div className="flex flex-col gap-3" key={date}>
                <SymptomsData
                  key={`${date}`}
                  data={items}
                  dict={dict}
                  lang={lang}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center my-8 text-gray-500">
          {/* @TODO: Add a message to the user in i18n */}
          No ICU data available for this condition
        </div>
      )}
    </>
  );
}
