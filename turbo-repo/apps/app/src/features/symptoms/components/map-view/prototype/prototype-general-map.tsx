"use client";

import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { Card } from "flowbite-react";
import Image from "next/image";
import PrototypeSideInfo from "./prototype-side-info";
import MapVisualizationTrip, {
  type CasePoint,
} from "@/features/geographic-view/components/map-visualization-trip";
import type { TreatmentsLocationResponseItem } from "@/app/api/treatments/location/route.type";
import { isEngineCaseId } from "@/features/symptoms/model/treatment-link";
import { chipText } from "./header-chip";
import { useTripPositions } from "@/features/geographic-view/hooks/use-trip-positions";
import { useTreatmentsGeneral } from "../../../hooks/use-treatments-general";
import { useEffect, useState } from "react";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import { useTreatmentsLocation } from "@/features/common/providers/client-api.provider";
import { titles } from "../../../types/symptom-titles";
import TagManager from "../../tag-manager";
import { FaTruck, FaMapPin, FaUser } from "react-icons/fa";
import { ConditionsAgg } from "../../../types/timeline";
import type { SelectedOption } from "../../../types/side-info";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SymptomContextCard from "./call-center/symptom-context-card";
import type { CallCenterReportedStep } from "./call-center/prototype-call-center-flow";
import { lugaresLayout } from "../lugares-layout";

const MENU_OPTIONS: SelectedOption[] = [
  "call_driver",
  "derive_to_specialist",
  "contact_carabineros",
  "contact_via_whatsapp",
  "copilot",
  "ignore_condition",
  "invalidate_symptom",
];

function isSelectedOption(value: string | null): value is SelectedOption {
  return !!value && (MENU_OPTIONS as string[]).includes(value);
}

function titleCase(value: string | null | undefined): string {
  return (
    value?.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) ?? ""
  );
}

function firstPoint(
  location: TreatmentsLocationResponseItem | null | undefined
): CasePoint | null {
  const feature = location?.features?.[0];
  return feature?.longitude != null && feature?.latitude != null
    ? { longitude: feature.longitude, latitude: feature.latitude }
    : null;
}

function panelWidths(
  isFormOpen: boolean,
  isCallDriver: boolean,
  isCallFormStep: boolean
): { side: string; map: string } {
  if (!isFormOpen) return { side: "35%", map: "65%" };
  if (!isCallDriver) return { side: "62%", map: "38%" };
  return isCallFormStep
    ? { side: "50%", map: "50%" }
    : { side: "33.3333%", map: "66.6667%" };
}

function contextRowClass(show: boolean): string {
  return show ? "grid-rows-[1fr]" : "grid-rows-[0fr]";
}

/**
 * PROTOTYPE — variant of `features/symptoms/components/map-view/general-map.tsx`.
 *
 * Same map + timeline side panel, but the treatment forms no longer open in a
 * modal. When `isFormOpen` flips, this container grows the side panel and shrinks
 * the map with a width transition — the morph used by the bento document viewer
 * (`task-bento-form/bento-media-section.tsx`). Used by the
 * `/symptoms/map-view/[id]` route.
 */
export default function PrototypeGeneralMap({
  dict,
  id,
  tripId,
  assetId,
}: Readonly<{
  dict: I18nRecord;
  id: string;
  tripId?: string;
  assetId?: string;
}>) {
  const pastFormsEnabled = useRuntimeConfig()?.SYMPTOMS_PAST_FORMS === "true";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { positions, error, isLoading } = useTripPositions(
    tripId ?? "",
    assetId ?? "",
    id
  );

  const {
    treatmentData,
    loading,
    error: errorTreatments,
  } = useTreatmentsGeneral(id);

  // Persisted in the URL (`?open=1&menu=…`) so a refresh or a shared link
  // lands back on the right menu — only "which menu is open", not the finer
  // steps inside it (e.g. mid-dial), which is what the leave-page warning is
  // for: those are expected to be lost on an actual reload.
  // The past forms stay out of the URL: opening one records a treatment, so a
  // reload must not reopen it, and their save navigates to the symptom list,
  // which a replace here would undo.
  const [isFormOpen, setIsFormOpen] = useState(
    () => !pastFormsEnabled && searchParams.get("open") === "1"
  );
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(() => {
    const fromUrl = searchParams.get("menu");
    return isSelectedOption(fromUrl) ? fromUrl : "call_driver";
  });
  const [callFlowStep, setCallFlowStep] =
    useState<CallCenterReportedStep | null>(null);

  useEffect(() => {
    if (pastFormsEnabled) return;
    const params = new URLSearchParams(searchParams.toString());
    if (isFormOpen) {
      params.set("open", "1");
      params.set("menu", selectedOption);
    } else {
      params.delete("open");
      params.delete("menu");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormOpen, selectedOption]);

  // The call flow stays narrow (1/3) through contacts/dialing/whatsapp — the
  // map is the more useful half of the screen until there's an actual form
  // to fill in — then widens to 1/2 for the final treatment form. `null`
  // (debug mode off) means the plain form with no steps in front of it, so
  // it's treated the same as reaching "form". Every other menu keeps 62/38.
  const isCallDriver = selectedOption === "call_driver";
  const isCallFormStep = callFlowStep === "form" || callFlowStep === null;
  // Past forms open as a fixed modal, so the side panel stays at its
  // resting width instead of morphing over the map.
  const anchos = panelWidths(
    pastFormsEnabled ? false : isFormOpen,
    isCallDriver,
    isCallFormStep
  );
  const [lugaresAbierto, setLugaresAbierto] = useState(false);
  const layout = lugaresLayout(lugaresAbierto, anchos);

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
    titleCase(selectedTreatmentIndex?.type?.toString()),
    selectedTreatmentIndex?.symptom_id?.toString() ?? ""
  );

  // A case without a trip keeps its opening point on the map, whichever
  // timeline entry or pulse is selected.
  const tripless = !tripId && isEngineCaseId(id);
  const { data: caseLocation } = useTreatmentsLocation(
    "",
    tripless ? titleCase(treatmentData?.symptom_info?.name) : "",
    id
  );
  const casePoint = tripless ? firstPoint(caseLocation) : null;

  useEffect(() => {
    if (errorTreatments) {
      router.push("/not-found");
    }
  }, [errorTreatments, router]);

  if (errorTreatments) return null;
  const symptomsDict = dict.symptoms as I18nRecord;
  const tripInfo = treatmentData?.trip_info;
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
                    text: chipText(
                      loading,
                      treatmentData?.symptom_info?.icu_code
                        ? (symptomsDict[
                            titles[
                              treatmentData.symptom_info.icu_code.toString() as keyof typeof titles
                            ]?.title
                          ] as string)
                        : null
                    ),
                  },
                  {
                    text: chipText(
                      loading,
                      treatmentData?.trip_info?.asset_id ?? assetId,
                      symptomsDict.license_plate as string
                    ),
                    icon: <FaTruck className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text: chipText(
                      loading,
                      tripInfo?.origin && tripInfo?.destination
                        ? `${tripInfo.origin} - ${tripInfo.destination}`
                        : null,
                      symptomsDict.route as string
                    ),
                    icon: (
                      <FaMapPin className="text-gray-900 dark:text-white" />
                    ),
                  },
                  {
                    text: chipText(loading, tripInfo?.driver),
                    icon: <FaUser className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text: tripInfo?.driver2,
                    icon: <FaUser className="text-gray-900 dark:text-white" />,
                  },
                  {
                    text: chipText(loading, tripInfo?.trip_id, "Trip id"),
                  },
                  {
                    text: chipText(
                      loading,
                      tripInfo?.carrier,
                      symptomsDict.transporter as string
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </Card>
      </div>
      <div className="flex flex-row w-full h-full px-2 pb-2 overflow-hidden">
        {/* Side information — grows when the inline form opens; folds away
            while Lugares is open on the map */}
        <div
          className="h-full rounded-lg shadow-md border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-500 ease-in-out"
          style={layout.sideStyle}
          aria-hidden={lugaresAbierto}
          inert={lugaresAbierto}
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
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            onCallFlowStepChange={setCallFlowStep}
          />
        </div>
        {/* Map — shrinks (width) when the inline form opens, and (height)
            makes room for the symptom-context row below it when that's showing. */}
        <div
          className="flex h-full flex-col gap-2 transition-[width] duration-500 ease-in-out"
          style={{ width: layout.mapWidth }}
        >
          <div className="min-h-0 flex-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
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
              onLugaresChange={setLugaresAbierto}
              casePoint={casePoint}
            />
          </div>
          {/* Keeps the symptom being called about visible without flipping
              back to the timeline — same amber "current symptom" card the
              timeline itself shows. A real row below the map (not an overlay
              on top of it, which the map's own controls kept covering) that
              pushes the map up; the grid-rows trick animates smoothly between
              0 and its natural height without a fixed height to guess at. */}
          <div
            className={`grid shrink-0 transition-[grid-template-rows] duration-500 ease-in-out ${contextRowClass(
              isFormOpen && isCallDriver && !!selectedTreatmentIndex
            )}`}
          >
            <div className="overflow-hidden">
              {selectedTreatmentIndex && (
                <SymptomContextCard
                  dict={dict}
                  subItem={selectedTreatmentIndex}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
