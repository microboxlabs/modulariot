import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import { Card } from "flowbite-react";
import SymptomsData from "@/features/symptoms/components/symptoms-list/symptoms-data";
import SymptomsListSkeleton from "@/features/symptoms/components/symptoms-list/symptoms-list-skeleton";

const test_data = [
  {
    id: 1,
    client: "Test Client",
    driver: "Test Driver",
    trip_id: "TEST-123",
    asset_id: "ASSET-123",
    end_time: "2025-02-17T12:30:00",
    start_time: "2025-02-17T12:00:00",
    duration_sec: 1800,
    symptom_name: "Test Symptom",
    icu_condition: "CODE_BLACK",
    treatment_count: 0,
    type_of_incidence: "Test Incidence",
    geographical_reference_point: "Test Location",
  },
];

export default async function DefaultSymptomsList({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);
  const loading = false;

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["mission_control", "symptoms", "symptoms-list"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      {/* 
        The reason of why there is no padding here but in the individual elements inside, is because the
        animation of hiding the cards is not working if there is padding.
      */}
      {loading ? (
        <SymptomsListSkeleton />
      ) : (
        <div className="relative overflow-visible px-5 flex flex-col gap-5">
          <Card
            className="flex flex-row animate-shadow-toggle"
            color="white"
            theme={{
              root: {
                children: "p-3",
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
                {(dict.symptoms as I18nRecord).urgent_symptoms as string}:{" "}
                {(dict.symptoms as I18nRecord).code_black as string}{" "}
                {(dict.symptoms as I18nRecord).active as string}
              </h1>
            </div>
          </Card>
          <div className="flex flex-col gap-6">
            {test_data.map((item, index) => (
              <SymptomsData key={index} data={item} dict={dict} lang={lang} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
