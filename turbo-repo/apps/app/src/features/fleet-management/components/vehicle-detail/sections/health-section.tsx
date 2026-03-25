"use client";

import type { Vehicle } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CircularProgress } from "@/features/common/components/circular-progress";
import { ProgressBar } from "@/features/common/components/progress-bar";
import { StatusIndicator } from "@/features/common/components/status-indicator";

interface HealthSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly healthScore: number;
}

export default function HealthSection({
  vehicle,
  dict,
  healthScore,
}: HealthSectionProps) {
  return (
    <ExpandableSection
      customIcon={<CircularProgress value={healthScore} />}
      title={
        <span
          className={
            healthScore >= 80
              ? "text-green-600 dark:text-green-400"
              : healthScore >= 60
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
          }
        >
          {healthScore >= 80
            ? tr("vehicleDetail.sections.health.stableHealth", dict)
            : healthScore >= 60
              ? tr("vehicleDetail.sections.health.moderateHealth", dict)
              : tr("vehicleDetail.sections.health.poorHealth", dict)}
        </span>
      }
      description={tr("vehicleDetail.sections.health.description", dict)}
      defaultExpanded
    >
      <div className="flex flex-col gap-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <ProgressBar
            value={healthScore}
            label={tr("vehicleDetail.sections.health.overallHealth", dict)}
            color={
              healthScore >= 80 ? "green" : healthScore >= 60 ? "yellow" : "red"
            }
          />
          <ProgressBar
            value={vehicle.fuelLevel}
            label={tr("vehicleDetail.sections.health.fuelLevel", dict)}
            color={
              vehicle.fuelLevel >= 50
                ? "green"
                : vehicle.fuelLevel >= 25
                  ? "yellow"
                  : "red"
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatusIndicator
            status={
              vehicle.status === "active"
                ? "good"
                : vehicle.status === "maintenance"
                  ? "warning"
                  : "critical"
            }
            label={tr("vehicleDetail.sections.health.operationalStatus", dict)}
          />
          <StatusIndicator
            status={
              healthScore >= 70
                ? "good"
                : healthScore >= 40
                  ? "warning"
                  : "critical"
            }
            label={tr("vehicleDetail.sections.health.systemsCheck", dict)}
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
