"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/map-view/blurrable-dropdown";
import SideInfoData from "./components/map-view/side-info-data";
import { useState } from "react";
import BlurrableSteppedMenu from "./components/blurrable-stepped-menu/blurrable-stepped-menu";
import { SelectedOption } from "./types/side-info";
import { useTreatmentsGeneral } from "./hooks/use-treatments-general";
import SideMenuSkeleton from "./components/map-view/side-menu-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function SideInfo({
  dict,
  lang,
  symptomId,
}: {
  dict: I18nRecord;
  lang: string;
  symptomId: string;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedOption, setSelectedOption] =
    useState<SelectedOption>("call_driver");
  const { treatmentData, loading, error } = useTreatmentsGeneral(symptomId);

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <SideMenuSkeleton />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col p-1 h-full">
      <BlurrableSteppedMenu
        selectedOption={selectedOption}
        lang={lang}
        dict={dict}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        treatmentData={treatmentData}
        className={`${isMenuOpen ? "animate-show" : "animate-hide"}`}
      />
      <div className="flex flex-col h-full overflow-y-auto">
        <SideInfoData
          dict={dict}
          lang={lang}
          treatmentData={treatmentData}
          loading={loading}
          error={error}
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
            className="h-10 rounded-l-none w-full"
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              setSelectedOption("call_driver");
            }}
          >
            {(dict.symptoms as I18nRecord).call_driver as string}
            <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Button.Group>
      </div>
    </div>
  );
}
