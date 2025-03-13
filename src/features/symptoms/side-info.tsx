"use client";

import { HiArrowRight } from "react-icons/hi";
import { Button } from "flowbite-react";
import BlurrableDropdown from "./components/map-view/blurrable-dropdown";
import SideInfoData from "./components/map-view/side-info-data";
import { useState } from "react";
import BlurrableSteppedMenu from "./components/blurrable-stepped-menu/blurrable-stepped-menu";
import { useTreatmentsGeneral } from "./hooks/use-treatments-general";
import SideMenuSkeleton from "./components/map-view/side-menu-skeleton";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useTreatmentsTemplates } from "../common/providers/client-api.provider";

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
  const { treatmentData, loading, error } = useTreatmentsGeneral(symptomId);
  const { treatments_templates } = useTreatmentsTemplates(
    treatmentData?.symptom_info?.icu_code.toString() ?? "4",
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-5 h-full">
        <SideMenuSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 h-full">
      {treatments_templates && (
        <BlurrableSteppedMenu
          lang={lang}
          dict={dict}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          treatmentData={treatmentData}
          treatments_templates={treatments_templates}
          className={`${isMenuOpen ? "animate-show" : "animate-hide"}`}
        />
      )}
      <div className="flex flex-col h-[90%] overflow-y-auto">
        <SideInfoData
          dict={dict}
          lang={lang}
          treatmentData={treatmentData}
          loading={loading}
          error={error}
        />
      </div>
      <div className="flex flex-col justify-self-end">
        <Button.Group className="w-full">
          <BlurrableDropdown
            dict={dict}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
          />
          <Button
            size="md"
            color="blue"
            className="h-10 rounded-l-none w-full"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {(dict.symptoms as I18nRecord).call_driver as string}
            <HiArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Button.Group>
      </div>
    </div>
  );
}
