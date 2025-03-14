"use client";

//import TitleCardSkeleton from "./title-card-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Card } from "flowbite-react";
import Image from "next/image";
import noAlarmImage from "@assets/images/no_alarm.gif";
import alarmImage from "@assets/images/alarm.gif";
import SideInfo from "@/features/symptoms/side-info";
import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import { useTreatmentsGeneral } from "../../hooks/use-treatments-general";

export default function GeneralMap({
  dict,
  lang,
  id,
  tripId,
  assetId,
}: {
  dict: I18nRecord;
  lang: string;
  id: string;
  tripId?: string;
  assetId?: string;
}) {
  const { positions, error } = useTripPositions(tripId ?? "", assetId ?? "");
  const {
    treatmentData,
    loading,
    error: errorTreatments,
  } = useTreatmentsGeneral(id);

  // this is wrong, we should get the average of the positions but im getting an acumulated value
  const averagePosition = positions?.reduce(
    (acc, curr) => {
      return {
        latitude: acc.latitude + curr.latitude / positions.length,
        longitude: acc.longitude + curr.longitude / positions.length,
      };
    },
    { latitude: 0, longitude: 0 },
  );

  if (error) {
    return <div>Error: {error.message}</div>;
  }
  return (
    <>
      {/*  {loading ? (
        <TitleCardSkeleton />
      ) :  */}
      <div className="mx-5 mb-5 relative flex flex-col gap-10 animate-shadow-toggle rounded-lg">
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
              className="w-8 h-8"
              src={
                treatmentData?.symptom_info.icu_code === 3 ||
                treatmentData?.symptom_info.icu_code === 4
                  ? alarmImage
                  : noAlarmImage
              }
              alt="Síntomas"
              width={50}
              height={50}
            />
            <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).symptom as string}:{" "}
              {
                (dict.symptoms as I18nRecord)?.[
                  treatmentData?.symptom_info?.icu_condition.toLowerCase() ??
                    "stable"
                ] as string
              }{" "}
              {/* {(dict.symptoms as I18nRecord).active as string} */}
            </h1>
          </div>
        </Card>
      </div>
      <div className="flex flex-row gap-6 w-full h-full px-5 pb-5 overflow-hidden">
        {/* Side information */}
        <div className="w-[35%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-y-auto">
          <SideInfo
            dict={dict}
            lang={lang}
            treatmentData={treatmentData}
            loading={loading}
            error={errorTreatments}
          />
          {/* Map */}
        </div>
        <div className="w-[65%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <MapVisualizationTrip
            positions={positions}
            error={error}
            tripId={tripId ?? ""}
            averagePosition={averagePosition}
          />
        </div>
      </div>
    </>
  );
}
