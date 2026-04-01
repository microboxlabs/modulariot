"use client";

import { HiOutlineShieldCheck } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import MessageBanner from "@/features/common/components/message-banner/message-banner";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { GoAlert } from "react-icons/go";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { VehicleDetailData } from "../vehicle-detail-accordion";

interface TechnicalHealthSectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
}

export default function TechnicalHealthSection({
  data,
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
      badge={
        <CustomBadge 
          text="1 falla crítica"
          className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        />
      }
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
