"use client";

import {
  HiOutlineWrenchScrewdriver,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import type { Vehicle } from "../../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { MessageBanner } from "@/features/common/components/message-banner";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { VehicleDetailData } from "../vehicle-detail-accordion";
import { formatDateString }  from "@/features/common/components/formatted-date/formatted-date";

interface MaintenanceSectionProps {
  readonly vehicle: Vehicle;
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
}

export default function MaintenanceSection({
  vehicle,
  data,
  dict,
}: MaintenanceSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineWrenchScrewdriver}
      title={tr("vehicleDetail.sections.maintenance.title", dict)}
      description={tr("vehicleDetail.sections.maintenance.description", dict)}
    >
      <div className="grid grid-cols-3 gap-3">
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.totalKm", dict),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: data.maintenance.totalKm.toLocaleString() + " km",
            className: "text-blue-600 dark:text-blue-400 bold",
          }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.totalKmDesc", dict),
            className: "text-gray-500 dark:text-gray-300/60",
          }}
          icon={{}}
          className="bg-blue-100/40 dark:bg-blue-600/10 border border-blue-500/50"
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.nextMaintenance",
              dict
            ),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: data.maintenance.nextMaintenanceKm.toLocaleString() + " km",
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.kmRemaining", dict, { km: "7,600", days: "20" }),
            className: "text-gray-500 dark:text-gray-300/60",
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.lastService", dict),
          }}
          value={{ text: formatDateString(data.maintenance.lastManteinanceDate) }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.atKm", dict, { km: "45,000" }),
          }}
          variant="vertical"
        />
          <KpiStat
            title={{
            text: tr(
              "vehicleDetail.sections.maintenance.contractualFrequency",
              dict
            ),
          }}
          value={{ text: data.maintenance.contractualFrecuency + " km" }}
          description={{
            text: tr(
              "vehicleDetail.sections.maintenance.contractualFrequencyDesc",
              dict
            ),
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.maintenanceCount",
              dict
            ),
          }}
          value={{
            text: data.maintenance.manteinancesCount.toString(),
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.maintenanceCountDesc", dict),
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.kmSinceService", dict),
          }}
          value={{
            text: data.maintenance.kmSinceManteinance.toLocaleString() + " km",
            className: "text-green-500 dark:text-green-400",
          }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.intervalPercent", dict, { percent: "24", interval: "10k" }),
          }}
          variant="vertical"
        />
      </div>
      <div className="mt-3">
        {(() => {
          switch (data.maintenance.status) {
            case "up_to_date":
              return (
                <MessageBanner
                  icon={HiOutlineCheckCircle}
                  title={tr("vehicleDetail.sections.maintenance.upToDate", dict)}
                  description={tr("vehicleDetail.sections.maintenance.upToDateDesc", dict)}
                  variant="success"
                />
              );
            case "due_soon":
              return null; // Add your handling for "due_soon" here if needed
            case "overdue":
              // Add your handling for "due_soon" and "overdue" here if needed
              return null;
            default:
              return null;
          }
        })()}
      </div>
    </ExpandableSection>
  );
}
