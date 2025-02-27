import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import { Card } from "flowbite-react";
import SymptomsData from "@/features/symptoms/components/symptoms-list/symptoms-data";

const test_data = [
  {
    date: "2025-02-17",
  },
];

interface SymptomsListParams extends ParamsWithLang {
  condition: string;
  lang: string;
}

export default async function SymptomsList({
  params: { lang, condition },
}: {
  params: SymptomsListParams;
}) {
  const [, dict] = await getDictionary(lang);
  const icuCondition = parseInt(condition);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 pt-6 pb-2">
        <Breadcrumb
          path={["mission_control", "symptoms", "symptoms-list"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      <div className="relative overflow-y-auto p-5 flex flex-col gap-10">
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
        <div className="flex flex-col gap-6">
          {test_data.map((item, index) => (
            <SymptomsData
              key={index}
              date={item.date}
              container_index={index}
              dict={dict}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
