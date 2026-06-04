"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";
import { TbDroplet, TbFilter, TbEngine } from "react-icons/tb";
import type { IconType } from "react-icons";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { CustomBadge } from "@/features/common/components/custom-badge";
import type { SectionStatus } from "../vehicle-detail-accordion";

interface TechnicalHealthSectionProps {
  readonly dict: I18nRecord;
  readonly status: SectionStatus;
}

interface HealthIndicator {
  readonly icon: IconType;
  readonly titleKey: string;
}

// Happy-path placeholder until the backend wiring lands. Shows three OK
// indicators (AdBlue, DPF, Engine Failure) to represent "no issues".
const HAPPY_PATH_INDICATORS: readonly HealthIndicator[] = [
  {
    icon: TbDroplet,
    titleKey: "vehicleDetail.sections.technicalHealth.adBlue",
  },
  {
    icon: TbFilter,
    titleKey: "vehicleDetail.sections.technicalHealth.dpf",
  },
  {
    icon: TbEngine,
    titleKey: "vehicleDetail.sections.technicalHealth.engineFailure",
  },
];

export default function TechnicalHealthSection({
  dict,
  status,
}: TechnicalHealthSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineShieldCheck}
      title={tr("vehicleDetail.sections.technicalHealth.title", dict)}
      description={tr(
        "vehicleDetail.sections.technicalHealth.description",
        dict
      )}
      status={status}
      badge={
        <CustomBadge
          text={tr("vehicleDetail.sections.technicalHealth.noIssues", dict)}
          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        />
      }
    >
      <div className="flex flex-col gap-3 w-full">
        {HAPPY_PATH_INDICATORS.map((indicator) => (
          <KpiStat
            key={indicator.titleKey}
            icon={{
              icon: indicator.icon,
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            title={{
              text: trDynamic(indicator.titleKey, dict),
            }}
            value={{
              text: tr("vehicleDetail.sections.technicalHealth.ok", dict),
              className: "text-green-500 dark:text-green-400 font-bold",
            }}
            className="w-full"
            tooltip
            variant="vertical"
          />
        ))}
      </div>
    </ExpandableSection>
  );
}
