"use client";

//import TitleCardSkeleton from "./title-card-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Card } from "flowbite-react";
import Image from "next/image";
import SideInfo from "@/features/symptoms/side-info";
import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import { useTreatmentsGeneral } from "../../hooks/use-treatments-general";
import { useState } from "react";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useTreatmentsLocation } from "@/features/common/providers/client-api.provider";
import { titles } from "../../types/symptom-titles";
/* import icuConditions from "@/features/symptoms/model/icu_condition.json"; */
import TagManager from "../tag-manager";
import { FaTruck, FaMapPin, FaUser } from "react-icons/fa";
import TitleCardSkeleton from "./title-card-skeleton";
import { ConditionsAgg } from "../../types/timeline";
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
  const { positions, error, isLoading } = useTripPositions(
    tripId ?? "",
    assetId ?? "",
  );

  const {
    treatmentData,
    loading,
    error: errorTreatments,
  } = useTreatmentsGeneral(id);

  const [selectedTreatment, setSelectedTreatment] =
    useState<TreatmentsGeneralResponseItem | null>(null);
  const [selectedTreatmentIndex, setSelectedTreatmentIndex] =
    useState<ConditionsAgg | null>(null);

  const {
    data: filteredLocationData,
    error: _locationError,
    isLoading: _locationLoading,
  } = useTreatmentsLocation(
    selectedTreatment?.trip_info?.trip_id ?? "",
    //format the first letter of each word in uppercase
    selectedTreatmentIndex?.type
      ?.toString()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()) ?? "",
    /* selectedTreatmentIndex?.start ?? "",
    selectedTreatmentIndex?.end ?? "", */
    selectedTreatmentIndex?.symptom_id?.toString() ?? "",
  );

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
      {loading ? (
        <TitleCardSkeleton />
      ) : (
        <div
          className={`mx-2 mb-2 relative flex flex-col gap-10 ${
            ["3", "4"].includes(
              treatmentData?.symptom_info?.icu_code?.toString() ?? "",
            )
              ? "animate-shadow-toggle"
              : ""
          } rounded-lg`}
        >
          <Card
            className="flex flex-row"
            color="white"
            theme={{
              root: {
                children: "p-2 w-full",
              },
            }}
          >
            <div className="flex flex-row gap-2 items-center justify-center w-full">
              {loading ? (
                <div className="w-8 h-8 bg-gray-400 dark:bg-gray-600 animate-pulse rounded-md" />
              ) : (
                <Image
                  className="w-8 h-8"
                  src={
                    titles[
                      treatmentData?.symptom_info
                        ?.icu_code as unknown as keyof typeof titles
                    ]?.icon
                  }
                  alt="Síntomas"
                  width={50}
                  height={50}
                />
              )}
              <h1
                className={`text-lg font-bold tracking-tight whitespace-nowrap ${
                  loading
                    ? "bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {(dict.symptoms as I18nRecord).symptom as string}:{" "}
                {loading
                  ? "Estado critico"
                  : ((dict.symptoms as I18nRecord)?.[
                      treatmentData?.symptom_info?.name?.toUpperCase() as string
                    ] as string) || treatmentData?.symptom_info?.name}
                {/* {" - "} {(
                  (dict.symptoms as I18nRecord)[
                    icuConditions[
                      ("" +
                        treatmentData?.symptom_info
                          ?.icu_code) as unknown as keyof typeof icuConditions
                    ]?.toLowerCase() as string
                  ] as string
                )?.trim() || treatmentData?.symptom_info?.icu_code} */}
              </h1>
              <div className="flex align-middle mx-2 gap-1 flex-grow">
                <TagManager
                  tag_style="bg-transparent border-gray-300 dark:border-gray-500 dark:text-white"
                  tags={[
                    {
                      text: treatmentData?.symptom_info?.icu_code
                        ? ((dict.symptoms as I18nRecord)[
                            titles[
                              treatmentData?.symptom_info?.icu_code.toString() as keyof typeof titles
                            ].title
                          ] as string)
                        : "Unknown Symptom",
                    },
                    {
                      text:
                        (dict.symptoms as I18nRecord).license_plate +
                        ": " +
                        treatmentData?.trip_info?.asset_id,
                      icon: (
                        <FaTruck className="text-gray-900 dark:text-white" />
                      ),
                    },
                    {
                      text:
                        (dict.symptoms as I18nRecord).route +
                        ": " +
                        treatmentData?.trip_info?.origin +
                        " - " +
                        treatmentData?.trip_info?.destination,
                      icon: (
                        <FaMapPin className="text-gray-900 dark:text-white" />
                      ),
                    },
                    {
                      text: treatmentData?.trip_info?.driver,
                      icon: (
                        <FaUser className="text-gray-900 dark:text-white" />
                      ),
                    },
                    {
                      text: treatmentData?.trip_info?.driver2,
                      icon: (
                        <FaUser className="text-gray-900 dark:text-white" />
                      ),
                    },
                    {
                      text: "Trip id: " + treatmentData?.trip_info?.trip_id,
                    },
                    {
                      text:
                        ((dict.symptoms as I18nRecord).transporter as string) +
                        ": " +
                        treatmentData?.trip_info?.carrier,
                    },
                  ]}
                />
              </div>
            </div>
          </Card>
        </div>
      )}
      <div className="flex flex-row gap-2 w-full h-full px-2 pb-2 overflow-hidden">
        {/* Side information */}
        <div className="w-[35%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <SideInfo
            dict={dict}
            lang={lang}
            treatmentData={treatmentData}
            loading={loading}
            error={errorTreatments}
            setSelectedTreatment={setSelectedTreatment}
            setSelectedTreatmentIndex={setSelectedTreatmentIndex}
          />
          {/* Map */}
        </div>
        <div className="w-[65%] h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <MapVisualizationTrip
            positions={positions}
            error={error}
            isLoading={isLoading}
            tripId={tripId ?? ""}
            averagePosition={averagePosition}
            filteredLocationData={filteredLocationData ?? null}
            dict={dict}
          />
        </div>
      </div>
    </>
  );
}
