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

interface MaintenanceSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

export default function MaintenanceSection({
  vehicle,
  dict,
}: MaintenanceSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineWrenchScrewdriver}
      title={tr("vehicleDetail.sections.maintenance.title", dict)}
      description={tr("vehicleDetail.sections.maintenance.description", dict)}
    >
      <div className="grid grid-cols-3 gap-3 pt-4">
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.totalKm", dict),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: vehicle.kmTraveled.toLocaleString() + " km",
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
            text: "55.000 km",
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: "Faltan 7,600 km (proyección: 20 días)",
            className: "text-gray-500 dark:text-gray-300/60",
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.lastService", dict),
          }}
          value={{ text: "25 Ene 2026" }}
          description={{
            text: "A los 45,000 km",
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
          value={{ text: "10,000 km" }}
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
            text: "5",
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: "Total de servicios completados",
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: "Km desde ultima",
          }}
          value={{
            text: "2.400 km",
            className: "text-green-500 dark:text-green-400",
          }}
          description={{
            text: "24% del intervalo (10k)",
          }}
          variant="vertical"
        />
      </div>
      <div className="mt-3">
        <MessageBanner
          icon={HiOutlineCheckCircle}
          title="Mantención al día"
          description="El vehículo cumple con el plan de mantención preventiva."
          variant="success"
        />
      </div>
    </ExpandableSection>
  );
}
