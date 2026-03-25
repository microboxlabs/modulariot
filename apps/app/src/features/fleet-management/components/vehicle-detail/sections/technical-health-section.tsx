"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { ProgressBar } from "@/features/common/components/progress-bar";
import { StatusIndicator } from "@/features/common/components/status-indicator";

interface TechnicalHealthSectionProps {
  readonly dict: I18nRecord;
}

export default function TechnicalHealthSection({
  dict,
}: TechnicalHealthSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineShieldCheck}
      title={tr("vehicleDetail.sections.technicalHealth.title", dict)}
      description={tr(
        "vehicleDetail.sections.technicalHealth.description",
        dict
      )}
    >
      <div className="flex flex-col gap-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <ProgressBar
            value={95}
            label={tr("vehicleDetail.sections.technicalHealth.engine", dict)}
            color="green"
          />
          <ProgressBar
            value={88}
            label={tr(
              "vehicleDetail.sections.technicalHealth.transmission",
              dict
            )}
            color="green"
          />
          <ProgressBar
            value={72}
            label={tr("vehicleDetail.sections.technicalHealth.brakes", dict)}
            color="yellow"
          />
          <ProgressBar
            value={90}
            label={tr("vehicleDetail.sections.technicalHealth.tires", dict)}
            color="green"
          />
        </div>
        <div className="flex flex-col gap-2">
          <StatusIndicator
            status="good"
            label={tr(
              "vehicleDetail.sections.technicalHealth.noErrorCodes",
              dict
            )}
          />
          <StatusIndicator
            status="warning"
            label={tr(
              "vehicleDetail.sections.technicalHealth.brakePadWear",
              dict
            )}
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
