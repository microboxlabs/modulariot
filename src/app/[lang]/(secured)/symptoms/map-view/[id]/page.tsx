import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { getDictionary } from "@/features/i18n/i18n.service";
import { HiClipboardList } from "react-icons/hi";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import { Card } from "flowbite-react";
import SideInfo from "@/features/symptoms/side-info";

import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";

import MapViewSkeleton from "@/features/symptoms/components/map-view/map-view-skeleton";
import TitleCardSkeleton from "@/features/symptoms/components/map-view/title-card-skeleton";

interface MapViewParams {
  params: {
    lang: string;
    id: string;
  }
}

export default async function SymptomList({
  params: { lang, id },
}: MapViewParams) {
  const [, dict] = await getDictionary(lang);

  const loading = false;

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-900">
      <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
        <Breadcrumb
          path={["mission_control", "symptoms", "map-view"]}
          lang={lang}
          rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
          dict={dict["symptoms"] as I18nRecord}
        />
      </div>
      {loading ? (
        <TitleCardSkeleton />
      ) : (
        <div className=" mx-5 relative flex flex-col gap-10 animate-shadow-toggle rounded-lg overflow-visible">
          <Card
            className="flex flex-row "
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
                {(dict.symptoms as I18nRecord).code_black as string}
              </h1>
            </div>
          </Card>
        </div>
      )}
      {loading ? (
        <MapViewSkeleton />
      ) : (
        <div className="flex flex-row gap-6 w-full h-full p-5 overflow-hidden">
          {/* Side information */}
          <div className="w-[35%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <SideInfo dict={dict} lang={lang} symptomId={id} />{/* 1439763 */}
          </div>
          {/* Map */}
          <div className="w-[65%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <MapVisualizationTrip
              dict={dict}
              specific_view={true}
              tripId={id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
