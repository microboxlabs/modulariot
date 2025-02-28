"use client";

import { Card } from "flowbite-react";
import { useSymptomsIcu } from "@/features/symptoms/hooks/use-symptoms-icu";
import { SymptomsICUItemResponse } from "@/app/api/symptoms/icu/route.type";
import SymptomsData from "@/features/symptoms/components/symptoms-list/symptoms-data";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import SymptomsListSkeleton from "./symptoms-list-skeleton";

interface SymptomsIcuListProps {
  condition: string;
  dict: any;
  lang: string;
}

export default function SymptomsIcuList({ condition, dict, lang }: SymptomsIcuListProps) {
  const { icuData, loading, error } = useSymptomsIcu(condition);

  if (loading) {
    return (
      <SymptomsListSkeleton />
    );
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

  return (
    <div className="flex flex-col gap-6">
      <Card
          className="flex flex-row animate-shadow-toggle"
          color="white"
          theme={{
            root: {
              children: "p-4",
            },
          }}
        >
          <div className="flex flex-row gap-2 items-center justify-center">
            <Image
              className="w-[54px] h-[54px]"
              src={noAlarmImage}
              alt="Síntomas Urgentes"
              width={54}
              height={54}
            />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).urgent_symptoms as string}:
              {(dict.symptoms as I18nRecord).code_black as string}{" "}
              {(dict.symptoms as I18nRecord).active as string}
            </h1>
          </div>
        </Card>
      {icuData.map((item: SymptomsICUItemResponse, index: number) => (
        <SymptomsData
          key={index}
          data={item}
          container_index={index}
          dict={dict}
          lang={lang}
        />
      ))}
    </div>
  );
} 