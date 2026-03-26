"use client";

import type { Vehicle } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CircularProgress } from "@/features/common/components/circular-progress";
import { ProgressBar } from "@/features/common/components/progress-bar";
import { StatusIndicator } from "@/features/common/components/status-indicator";

type HealthColor = "green" | "yellow" | "red";
type StatusLevel = "good" | "warning" | "critical";

function getHealthTitleClass(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getHealthTitleKey(score: number): string {
  if (score >= 80) return "vehicleDetail.sections.health.stableHealth";
  if (score >= 60) return "vehicleDetail.sections.health.moderateHealth";
  return "vehicleDetail.sections.health.poorHealth";
}

function getHealthColor(score: number): HealthColor {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function getFuelColor(level: number): HealthColor {
  if (level >= 50) return "green";
  if (level >= 25) return "yellow";
  return "red";
}

function getOperationalStatus(status: Vehicle["status"]): StatusLevel {
  if (status === "active") return "good";
  if (status === "maintenance") return "warning";
  return "critical";
}

function getSystemsCheckStatus(score: number): StatusLevel {
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

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
        <span className={getHealthTitleClass(healthScore)}>
          {tr(getHealthTitleKey(healthScore), dict)}
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
            color={getHealthColor(healthScore)}
          />
          <ProgressBar
            value={vehicle.fuelLevel}
            label={tr("vehicleDetail.sections.health.fuelLevel", dict)}
            color={getFuelColor(vehicle.fuelLevel)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatusIndicator
            status={getOperationalStatus(vehicle.status)}
            label={tr("vehicleDetail.sections.health.operationalStatus", dict)}
          />
          <StatusIndicator
            status={getSystemsCheckStatus(healthScore)}
            label={tr("vehicleDetail.sections.health.systemsCheck", dict)}
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
