"use client";

import type { Vehicle } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CircularProgress } from "@/features/common/components/circular-progress";
import { ProgressBar } from "@/features/common/components/progress-bar";
import { StatusIndicator } from "@/features/common/components/status-indicator";
import MessageBanner from "@/features/common/components/message-banner/message-banner";
import { GoAlert } from "react-icons/go";
import KpiStat from "@/features/common/components/kpi-stat/kpi-stat";

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
      <div className="flex flex-col gap-4">
        <MessageBanner
          icon={GoAlert}
          title="Falla DPF - Saturación crítica"
          description="Sistema de filtro de partículas diésel requiere regeneración urgente (Detectada: 10 Feb 2026 14:45)"
          variant="error"
        />
        <MessageBanner
          icon={GoAlert}
          title="Falla sensor presión neumáticos"
          description="TPMS reporta error en sensor rueda delantera derecha (Detectada: 22 Ene 2026 16:30)"
          variant="warning"
        />
        <div className="flex flex-row gap-3 w-full">
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            value={{
              text: "2",
              className: "text-green-500 dark:text-green-400 font-bold",
            }}
            title={{
              text: tr("vehicleDetail.sections.health.activeFailures", dict)
            }}
            className="w-full"
            variant="vertical"
          />
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            title={{
              text: tr("vehicleDetail.sections.health.resolved30days", dict)
            }}
            value={{
              text: "5",
              className: "text-green-500 dark:text-green-400 font-bold",
            }}
            className="w-full"
            variant="vertical"
          />
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            title={{
              text: tr("vehicleDetail.sections.health.responseTime", dict)
            }}
            value={{
              text: "18h",
              className: "text-green-500 dark:text-green-400 font-bold",
            }}
            className="w-full"
            variant="vertical"
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
