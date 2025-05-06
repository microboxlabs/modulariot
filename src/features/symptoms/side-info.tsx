"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/map-view/blurrable-dropdown";
import { useState } from "react";
import BlurrableSteppedMenu from "./components/blurrable-stepped-menu/blurrable-stepped-menu";
import { SelectedOption } from "./types/side-info";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useTreatmentsTemplates } from "../common/providers/client-api.provider";
import {
  TreatmentsGeneralResponseItem,
  TreatmentsTimelineResponse,
} from "@/app/api/treatments/general/route.type";
import TimelineComponent from "./components/map-view/timeline";
import { FaClock } from "react-icons/fa";

export default function SideInfo({
  dict,
  lang,
  treatmentData,
  loading,
  error,
  setSelectedTreatment,
  setSelectedTreatmentIndex,
}: {
  dict: I18nRecord;
  lang: string;
  treatmentData: TreatmentsGeneralResponseItem | null;
  loading: boolean;
  error: Error | null;
  setSelectedTreatment: (treatment: TreatmentsGeneralResponseItem) => void;
  setSelectedTreatmentIndex: (
    treatmentIndex: TreatmentsTimelineResponse,
  ) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedOption, setSelectedOption] =
    useState<SelectedOption>("call_driver");
  const { treatments_templates } = useTreatmentsTemplates(
    treatmentData?.symptom_info?.id.toString() ?? "1",
    treatmentData?.symptom_info?.name ?? "Bad Sign",
    treatmentData?.symptom_info?.icu_code.toString() ?? "4",
  );

  /*
  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <SideMenuSkeleton />
      </div>
    );
  }*/

  if (error) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <div className="text-red-500 text-center p-4">
          {error?.message || "No treatment data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col p-1 h-full">
      {treatments_templates && !loading && (
        <BlurrableSteppedMenu
          selectedOption={selectedOption}
          lang={lang}
          dict={dict}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          treatmentData={treatmentData}
          treatments_templates={treatments_templates}
          className={`${isMenuOpen ? "animate-show" : "animate-hide"}`}
        />
      )}
      <div className="flex flex-col h-full overflow-y-auto pb-20 gap-1">
        <div className="px-2 py-1 border border-gray-300 dark:border-gray-700 flex flex-row items-center gap-2 rounded-md transition-all duration-200">
          <div
            className={` text-gray-900 dark:text-white flex items-center justify-center transition-all duration-200  rounded-md  w-5 h-5 border-transparent bg-transparent"}`}
          >
            <FaClock />
          </div>
          <div className="flex flex-col w-full justify-center align-middle">
            <h1 className="text-md font-bold text-gray-900 dark:text-white">
              {(dict.symptoms as I18nRecord).timeline as string}
            </h1>
          </div>
        </div>
        {loading ? (
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md"></div>
        ) : (
          <TimelineComponent
            lang={lang}
            dict={dict}
            treatmentData={treatmentData}
            setSelectedTreatment={setSelectedTreatment}
            setSelectedTreatmentIndex={setSelectedTreatmentIndex}
          />
        )}
      </div>
      <div
        className={`absolute bottom-5 left-5 right-5 flex flex-col justify-self-end w-full px-5 ${loading ? "opacity-50" : "opacity-100"}`}
      >
        <Button.Group className="w-full">
          <BlurrableDropdown
            dict={dict}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            setSelectedOption={setSelectedOption}
          />
          <Button
            size="md"
            color="blue"
            className="h-10 rounded-l-none w-full whitespace-nowrap"
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              setSelectedOption("call_driver");
            }}
          >
            {(dict.symptoms as I18nRecord).call_driver as string}
            <HiArrowRight className="ml-2 h-5 w-5 xl:flex lg:hidden" />
          </Button>
        </Button.Group>
      </div>
    </div>
  );
}
