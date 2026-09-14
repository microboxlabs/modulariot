"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Card } from "flowbite-react";
import Image from "next/image";
import PrototypeSideInfo from "./prototype-side-info";
import MapVisualizationTrip from "@/features/geographic-view/components/map-visualization-trip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import { useTreatmentsGeneral } from "../../../hooks/use-treatments-general";
import { useEffect, useState } from "react";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useTreatmentsLocation } from "@/features/common/providers/client-api.provider";
import { titles } from "../../../types/symptom-titles";
import TagManager from "../../tag-manager";
import { FaTruck, FaMapPin, FaUser } from "react-icons/fa";
import { ConditionsAgg } from "../../../types/timeline";
import { useRouter } from "next/navigation";

/**
 * PROTOTYPE — variant of `features/symptoms/components/map-view/general-map.tsx`.
 *
 * Same map + timeline side panel, but the treatment forms no longer open in a
 * modal. When `isFormOpen` flips, this container grows the side panel and shrinks
 * the map with a width transition — the morph used by the bento document viewer
 * (`task-bento-form/bento-media-section.tsx`). Wired into the unlisted
 * `/symptoms/prototipe-map-view/[id]` route only.
 */
export default function PrototypeGeneralMap({
  dict,
  id,
  tripId,
  assetId,
}: {
  dict: I18nRecord;
  id: string;
  tripId?: string;
  assetId?: string;
}) {
  const router = useRouter();
  const { positions, error, isLoading } = useTripPositions(
    tripId ?? "",
    assetId ?? ""
  );

  const {
    treatmentData,
    loading,
    error: errorTreatments,
  } = useTreatmentsGeneral(id);

  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedTreatment, setSelectedTreatment] =
    useState<TreatmentsGeneralResponseItem | null>(null);
  const [selectedTreatmentIndex, setSelectedTreatmentIndex] =
    useState<ConditionsAgg | null>(null);

  useEffect(() => {
    if (treatmentData?.timeline) {
      treatmentData.timeline.forEach((item) => {
        item.conditions_agg?.forEach((condition) => {
          if (condition.symptom_id == treatmentData.symptom_info?.id) {
            setSelectedTreatment(treatmentData);
            setSelectedTreatmentIndex(condition);
          }
        });
      });
    }
  }, [treatmentData]);

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
    selectedTreatmentIndex?.symptom_id?.toString() ?? ""
  );

  useEffect(() => {
    if (errorTreatments) {
      router.push("/not-found");
    }
  }, [errorTreatments, router]);

  if (errorTreatments) return null;
  return (
    <>
      <div
        className={`mx-2 mb-2 relative flex flex-col gap-10 ${
          ["3", "4"].includes(
            treatmentData?.symptom_info?.icu_code?.toString() ?? ""
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
              <div className="w-8 h-8 bg-gray-400 dark:bg-gray-600 animate-pulse rounded-full" />
            ) : (
              titles[
                treatmentData?.symptom_info
                  ?.icu_code as unknown as keyof typeof titles
              ]?.icon && (
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
              )
            )}
            <h1
              className={`flex flex-row gap-1 text-lg font-bold tracking-tight whitespace-nowrap ${"text-gray-900 dark:text-white"}`}
            >
              {(dict.symptoms as I18nRecord).symptom as string}:{" "}
              {loading ? (
                <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                  loading example text
                </div>
              ) : (
                ((dict.symptoms as I18nRecord)?.[
                  treatmentData?.symptom_info?.name?.toUpperCase() as string
                ] as string) || treatmentData?.symptom_info?.name
              )}
            </h1>
            <div className="flex align-middle mx-2 gap-1 flex-grow">
              <TagManager
                tag_style="bg-transparent border-gray-300 dark:border-gray-500 dark:text-white"
                tags={[
                  {
                    text: treatmentData?.symptom_info?.icu_code ? (
                      ((dict.symptoms as I18nRecord)[
                        titles[
                          treatmentData?.symptom_info?.icu_code.toString() as keyof typeof titles
                        ].title
                      ] as string)
                    ) : (
                      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                        ejemplo
                      </div>
                    ),
                  },
                  {
                    text: treatmentData?.trip_info?.asset_id ? (
                      ((dict.symptoms as I18nRecord).license_plate as string) +
                      ": " +
                      treatmentData?.trip_info?.asset_id
                    ) : (
                      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                        ejemplo
                      </div>
                    ),
                    icon: <FaTruck className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text:
                      treatmentData?.trip_info?.origin &&
                      treatmentData?.trip_info?.destination ? (
                        ((dict.symptoms as I18nRecord).route as string) +
                        ": " +
                        treatmentData?.trip_info?.origin +
                        " - " +
                        treatmentData?.trip_info?.destination
                      ) : (
                        <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                          ejemplo
                        </div>
                      ),
                    icon: (
                      <FaMapPin className="text-gray-900 dark:text-white" />
                    ),
                  },
                  {
                    text: treatmentData?.trip_info?.driver ? (
                      treatmentData?.trip_info?.driver
                    ) : (
                      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                        ejemplo
                      </div>
                    ),
                    icon: <FaUser className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text:
                      treatmentData?.trip_info?.driver2 ??
                      treatmentData?.trip_info?.driver2,
                    icon: <FaUser className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text: treatmentData?.trip_info?.trip_id ? (
                      "Trip id: " + treatmentData?.trip_info?.trip_id
                    ) : (
                      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                        ejemplo
                      </div>
                    ),
                  },
                  {
                    text: treatmentData?.trip_info?.carrier ? (
                      ((dict.symptoms as I18nRecord).transporter as string) +
                      ": " +
                      treatmentData?.trip_info?.carrier
                    ) : (
                      <div className="bg-gray-400 dark:bg-gray-600 text-gray-400 dark:text-gray-600 animate-pulse rounded-md">
                        ejemplo
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </Card>
      </div>
      <div className="flex flex-row gap-2 w-full h-full px-2 pb-2 overflow-hidden">
        {/* Side information — grows when the inline form opens */}
        <div
          className="h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-[width] duration-500 ease-in-out"
          style={{ width: isFormOpen ? "62%" : "35%" }}
        >
          <PrototypeSideInfo
            dict={dict}
            treatmentData={treatmentData}
            loading={loading}
            error={errorTreatments}
            setSelectedTreatment={setSelectedTreatment}
            setSelectedTreatmentIndex={setSelectedTreatmentIndex}
            isFormOpen={isFormOpen}
            setIsFormOpen={setIsFormOpen}
          />
        </div>
        {/* Map — shrinks when the inline form opens, never fully hidden */}
        <div
          className="h-full rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-[width] duration-500 ease-in-out"
          style={{ width: isFormOpen ? "38%" : "65%" }}
        >
          <MapVisualizationTrip
            positions={positions}
            error={error}
            isLoading={isLoading}
            tripId={tripId ?? ""}
            filteredLocationData={filteredLocationData ?? null}
            dict={dict}
            selectedTreatmentIndex={selectedTreatmentIndex ?? null}
            setSelectedTreatment={setSelectedTreatment}
            setSelectedTreatmentIndex={setSelectedTreatmentIndex}
            licensePlate={treatmentData?.trip_info?.asset_id ?? null}
          />
        </div>
      </div>
    </>
  );
}
