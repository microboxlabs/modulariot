"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CircularProgress } from "@/features/common/components/circular-progress";
import MessageBanner from "@/features/common/components/message-banner/message-banner";
import { GoAlert, GoCheckCircle } from "react-icons/go";
import { SectionStatus, SectionStatuses } from "../vehicle-detail-accordion";
import {
  HiOutlineWrenchScrewdriver,
  HiOutlineShieldCheck,
  HiOutlineSignal,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";

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

const statusStyles: Record<
  SectionStatus,
  {
    bg: string;
    text: string;
    border: string;
    statusIcon: typeof HiOutlineCheckCircle;
    statusIconClass: string;
  }
> = {
  ok: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    statusIcon: HiOutlineCheckCircle,
    statusIconClass: "text-green-500",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
    statusIcon: HiOutlineExclamationCircle,
    statusIconClass: "text-yellow-500",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    statusIcon: HiOutlineExclamationCircle,
    statusIconClass: "text-red-500",
  },
};

const sectionConfig = [
  {
    key: "maintenance" as const,
    icon: HiOutlineWrenchScrewdriver,
    labelKey: "vehicleDetail.sections.maintenance.title",
  },
  {
    key: "technicalHealth" as const,
    icon: HiOutlineShieldCheck,
    labelKey: "vehicleDetail.sections.technicalHealth.title",
  },
  {
    key: "telemetry" as const,
    icon: HiOutlineSignal,
    labelKey: "vehicleDetail.sections.telemetry.title",
  },
  {
    key: "events" as const,
    icon: HiOutlineExclamationTriangle,
    labelKey: "vehicleDetail.sections.events.title",
  },
  {
    key: "usage" as const,
    icon: HiOutlineArrowPath,
    labelKey: "vehicleDetail.sections.usage.title",
  },
];

interface HealthSectionProps {
  readonly dict: I18nRecord;
  readonly healthScore: number;
  readonly statuses: SectionStatuses;
}

export default function HealthSection({
  dict,
  healthScore,
  statuses,
}: HealthSectionProps) {
  const criticalSections = sectionConfig.filter(
    (s) => statuses[s.key] === "critical"
  );
  const warningSections = sectionConfig.filter(
    (s) => statuses[s.key] === "warning"
  );

  return (
    <ExpandableSection
      customIcon={<CircularProgress value={healthScore} size={72} max={1000} />}
      title={
        <span className={getHealthTitleClass(healthScore)}>
          {trDynamic(getHealthTitleKey(healthScore), dict)}
        </span>
      }
      description={tr("vehicleDetail.sections.health.description", dict)}
      defaultExpanded
    >
      <div className="flex flex-col gap-3">
        {/* Section Status Cards */}
        <div className="grid grid-cols-5 gap-3">
          {sectionConfig.map((section) => {
            const status = statuses[section.key];
            const styles = statusStyles[status];
            const Icon = section.icon;
            const StatusIcon = styles.statusIcon;

            return (
              <div
                key={section.key}
                className={`flex flex-col items-center p-3 rounded-lg border ${styles.bg} ${styles.border} transition-all hover:shadow-sm`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 ${styles.text}`} />
                  <StatusIcon
                    className={`w-3 h-3 ${styles.statusIconClass} absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full`}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium mt-2 text-center leading-tight ${styles.text}`}
                >
                  {trDynamic(section.labelKey, dict)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Critical Issues */}
        {criticalSections.length > 0 && (
          <MessageBanner
            icon={GoAlert}
            title={`${criticalSections.length} ${tr("vehicleDetail.sections.health.criticalIssues", dict) || "problema(s) crítico(s)"}`}
            description={criticalSections
              .map((s) => trDynamic(s.labelKey, dict))
              .join(" • ")}
            variant="error"
          />
        )}

        {/* Warning Issues */}
        {warningSections.length > 0 && (
          <MessageBanner
            icon={GoAlert}
            title={`${warningSections.length} ${tr("vehicleDetail.sections.health.warningIssues", dict) || "alerta(s)"}`}
            description={warningSections
              .map((s) => trDynamic(s.labelKey, dict))
              .join(" • ")}
            variant="warning"
          />
        )}

        {/* All OK */}
        {criticalSections.length === 0 && warningSections.length === 0 && (
          <MessageBanner
            icon={GoCheckCircle}
            title={
              tr("vehicleDetail.sections.health.allSystemsOk", dict) ||
              "Todos los sistemas operando normalmente"
            }
            description={
              tr("vehicleDetail.sections.health.allSystemsOkDesc", dict) ||
              "No se detectaron problemas en ninguna sección"
            }
            variant="success"
          />
        )}
      </div>
    </ExpandableSection>
  );
}
