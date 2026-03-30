"use client";

import { HiOutlineArrowPath } from "react-icons/hi2";
import type { Vehicle, VehicleGamification } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { InfoRow } from "@/features/common/components/info-row";
import { ProgressBar } from "@/features/common/components/progress-bar";

interface UsageSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly gamification?: VehicleGamification;
}

export default function UsageSection({
  vehicle,
  dict,
  gamification,
}: UsageSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineArrowPath}
      title={tr("vehicleDetail.sections.usage.title", dict)}
      description={tr("vehicleDetail.sections.usage.description", dict)}
    >
      <div className="flex flex-col gap-3 pt-4">
        <InfoRow
          label={tr("vehicleDetail.sections.usage.totalKm", dict)}
          value={vehicle.kmTraveled.toLocaleString() + " km"}
        />
        <InfoRow
          label={tr("vehicleDetail.sections.usage.avgDailyKm", dict)}
          value="185 km"
        />
        <InfoRow
          label={tr("vehicleDetail.sections.usage.utilizationRate", dict)}
          value="78%"
        />
        <InfoRow
          label={tr("vehicleDetail.sections.usage.idleTime", dict)}
          value="12%"
        />
        {gamification && (
          <ProgressBar
            value={
              gamification.weeklyKmGoal > 0
                ? Math.round(
                    (gamification.weeklyKmProgress / gamification.weeklyKmGoal) *
                      100
                  )
                : 0
            }
            label={tr("vehicleDetail.sections.usage.weeklyGoal", dict)}
            color="blue"
          />
        )}
      </div>
    </ExpandableSection>
  );
}
