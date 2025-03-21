"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/map-view/blurrable-dropdown";
import SideInfoData from "./components/map-view/side-info-data";
import { useState } from "react";
import BlurrableSteppedMenu from "./components/blurrable-stepped-menu/blurrable-stepped-menu";
import { SelectedOption } from "./types/side-info";
import SideMenuSkeleton from "./components/map-view/side-menu-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useTreatmentsTemplates } from "../common/providers/client-api.provider";
import {
  TreatmentsGeneralResponseItem,
  TreatmentsTimelineResponse,
} from "@/app/api/treatments/general/route.type";

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
    treatmentData?.symptom_info?.icu_code.toString() ?? "4",
    treatmentData?.symptom_info?.name ?? "Bad Sign",
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <SideMenuSkeleton />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col p-1 h-full">
      {treatments_templates && (
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
      <div className="flex flex-col h-full overflow-y-auto">
        <SideInfoData
          dict={dict}
          lang={lang}
          treatmentData={treatmentData}
          loading={loading}
          error={error}
          setSelectedTreatment={setSelectedTreatment}
          setSelectedTreatmentIndex={setSelectedTreatmentIndex}
        />
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex flex-col justify-self-end w-full px-5">
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
