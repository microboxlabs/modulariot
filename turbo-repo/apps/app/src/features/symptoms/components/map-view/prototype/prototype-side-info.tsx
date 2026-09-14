"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button, ButtonGroup, Tooltip } from "flowbite-react";
import BlurrableDropdown from "../blurrable-dropdown";
import { useState } from "react";
import { SelectedOption } from "../../../types/side-info";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  useTreatmentsTemplates,
  useUserGroups,
} from "../../../../common/providers/client-api.provider";
import { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import TimelineComponent from "../timeline";
import { FaClock } from "react-icons/fa";
import { TbSortAscendingShapes, TbSortDescendingShapes } from "react-icons/tb";
import { ConditionsAgg } from "../../../types/timeline";
import { GroupAllowed } from "../../../../common/components/group-allowed/group-allowed";
import PrototypeInlineForm from "./prototype-inline-form";

/**
 * PROTOTYPE — inline variant of `features/symptoms/side-info.tsx`.
 *
 * Instead of opening the treatment forms ("Llamar a…", "Otras opciones") in a
 * fixed full-screen blurred modal, the forms render *inside* this panel. The
 * parent (`prototype-general-map.tsx`) grows this panel and shrinks the map when
 * `isFormOpen` flips — the same morph the bento document viewer does.
 */
export default function PrototypeSideInfo({
  dict,
  treatmentData,
  loading,
  error,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
  isFormOpen,
  setIsFormOpen,
}: {
  dict: I18nRecord;
  treatmentData: TreatmentsGeneralResponseItem | null;
  loading: boolean;
  error: Error | null;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (treatmentIndex: ConditionsAgg) => void;
  isFormOpen: boolean;
  setIsFormOpen: (isFormOpen: boolean) => void;
}) {
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedOption, setSelectedOption] =
    useState<SelectedOption>("call_driver");
  const { treatments_templates } = useTreatmentsTemplates(
    treatmentData?.symptom_info?.id.toString() ?? "1",
    treatmentData?.symptom_info?.name ?? "Bad Sign",
    treatmentData?.symptom_info?.icu_code.toString() ?? "4"
  );

  const { data: userGroups } = useUserGroups();

  if (error) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <div className="text-red-500 text-center p-4">
          {error?.message || "No treatment data available"}
        </div>
      </div>
    );
  }

  const formReady = !!treatments_templates && !loading;

  return (
    <div className="relative flex flex-col p-1 h-full overflow-hidden">
      {/* Inline morphed form — replaces the timeline + action buttons in place.
          Fades in after the parent's width transition (~500ms) has mostly run. */}
      {isFormOpen && formReady && (
        <div
          className="absolute inset-0 z-20 animate-fade-in-opacity"
          style={{ animationDelay: "250ms", opacity: 0 }}
        >
          <PrototypeInlineForm
            selectedOption={selectedOption}
            dict={dict}
            isMenuOpen={isFormOpen}
            setIsMenuOpen={setIsFormOpen}
            treatmentData={treatmentData}
            treatments_templates={treatments_templates}
          />
        </div>
      )}

      {/* Timeline view — hidden while the inline form is open */}
      {!isFormOpen && (
        <>
          <div className="flex flex-col h-full overflow-y-auto pb-20 gap-1">
            <div className="border border-gray-300 dark:border-gray-700 flex flex-row items-center justify-between gap-2 rounded-md transition-all duration-200">
              <div className="flex flex-row items-center gap-2 pl-2 py-1">
                <div className="text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200 rounded-md w-5 h-5 border-transparent bg-transparent">
                  <FaClock />
                </div>
                <div className="flex flex-col w-full justify-center align-middle">
                  <h1 className="text-md font-bold text-gray-900 dark:text-white">
                    {(dict.symptoms as I18nRecord).timeline as string}
                  </h1>
                </div>
              </div>
              <Tooltip
                content={
                  order === "asc"
                    ? ((dict.symptoms as I18nRecord).ascending as string)
                    : ((dict.symptoms as I18nRecord).descending as string)
                }
              >
                <div
                  className="h-6 w-6 p-1 mr-1 hover:bg-gray-100 hover:cursor-pointer dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200 rounded-md"
                  onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
                >
                  {order === "asc" ? (
                    <TbSortAscendingShapes
                      className={`h-5 w-5 transition-all duration-200 ${order === "asc" ? "rotate-180" : ""}`}
                    />
                  ) : (
                    <TbSortDescendingShapes
                      className={`h-5 w-5 transition-all duration-200 ${order === "desc" ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </Tooltip>
            </div>
            {loading ? (
              <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md"></div>
            ) : (
              <TimelineComponent
                dict={dict}
                treatmentData={treatmentData}
                setSelectedTreatment={setSelectedTreatment}
                setSelectedTreatmentIndex={setSelectedTreatmentIndex}
                order={order}
              />
            )}
          </div>
          <div
            className={`absolute bottom-5 left-5 right-5 flex flex-col justify-self-end w-full px-5 ${loading ? "opacity-50" : "opacity-100"}`}
          >
            <GroupAllowed
              notAllowedTo={[]} /* DEMO LOCAL: era GROUP_MINTRAL_REVISOR */
              userGroups={userGroups}
            >
              <ButtonGroup className="w-full">
                <BlurrableDropdown
                  dict={dict}
                  isMenuOpen={isFormOpen}
                  setIsMenuOpen={setIsFormOpen}
                  setSelectedOption={setSelectedOption}
                />
                <Button
                  size="md"
                  color="blue"
                  className="h-10 rounded-l-none w-full whitespace-nowrap"
                  onClick={() => {
                    setSelectedOption("call_driver");
                    setIsFormOpen(true);
                  }}
                >
                  {(dict.symptoms as I18nRecord).call_driver as string}
                  <HiArrowRight className="ml-2 h-5 w-5 xl:flex lg:hidden" />
                </Button>
              </ButtonGroup>
            </GroupAllowed>
          </div>
        </>
      )}
    </div>
  );
}
