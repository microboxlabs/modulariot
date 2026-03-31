"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import MessageBanner from "@/features/common/components/message-banner/message-banner";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { GoAlert } from "react-icons/go";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { VehicleDetailData, SectionStatus } from "../vehicle-detail-accordion";

interface TechnicalHealthSectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
  readonly status: SectionStatus;
}

export default function TechnicalHealthSection({
  data,
  dict,
  status,
}: TechnicalHealthSectionProps) {
  const criticalCount = data.technicalHealth.alerts.filter(a => a.type === "critical").length;
  const warningCount = data.technicalHealth.alerts.filter(a => a.type === "warning").length;
  
  const getBadge = () => {
    if (criticalCount > 0) {
      return (
        <CustomBadge 
          text={`${criticalCount} falla${criticalCount > 1 ? 's' : ''} crítica${criticalCount > 1 ? 's' : ''}`}
          className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
      );
    }
    if (warningCount > 0) {
      return (
        <CustomBadge 
          text={`${warningCount} alerta${warningCount > 1 ? 's' : ''}`}
          className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        />
      );
    }
    return (
      <CustomBadge 
        text={tr("vehicleDetail.sections.technicalHealth.noIssues", dict) || "Sin fallas"}
        className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      />
    );
  };
  
  return (
    <ExpandableSection
      icon={HiOutlineShieldCheck}
      title={tr("vehicleDetail.sections.technicalHealth.title", dict)}
      description={tr(
        "vehicleDetail.sections.technicalHealth.description",
        dict
      )}
      status={status}
      badge={getBadge()}
    >
      <div className="flex flex-col gap-3">
        {data.technicalHealth.alerts.map((alert) => (
          <MessageBanner
            key={`${alert.type}-${alert.title}`}
            icon={GoAlert}
            title={alert.title}
            description={alert.description}
            variant={alert.type === "critical" ? "error" : "warning"}
          />
        ))}
        <div className="flex flex-row gap-3 w-full">
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            value={{
              text: data.technicalHealth.activeFailures.toString(),
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
              text: data.technicalHealth.resolved.toString(),
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
              text: data.technicalHealth.responseTimeHour.toString() + " hrs",
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
