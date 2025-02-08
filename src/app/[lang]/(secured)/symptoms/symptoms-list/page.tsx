import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import { Card } from "flowbite-react";
import SymptomsData from "@/features/symptoms/components/symptoms-data";

const test_data = [
  {
    date: "2025-02-06",
  },
  {
    date: "2025-02-05",
  },
  {
    date: "2025-02-04",
  },
  {
    date: "2025-02-03",
  },
  {
    date: "2024-10-31",
  },
]

export default async function SymptomsList({
  params: { lang },
}: ParamsWithLang) {
  const [, dict] = await getDictionary(lang);
  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-4 pt-6 pb-2">
        <Breadcrumb
          path={["Control Tower", "symptoms", "Urgent Symptoms"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict}
        />
      </div>
      {/* 
        The reason of why there is no padding here but in the individual elements inside, is because the
        animation of hiding the cards is not working if there is padding.
      */}
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
              Síntomas urgentes: Código Negro Activo
            </h1>
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          {test_data.map((item) => (
            <SymptomsData date={item.date} />
          ))}
        </div>
      </div>
    </div>
  );
}
