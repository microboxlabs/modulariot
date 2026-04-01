"use client";

import type { ColaboratorKpi } from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KpiStat } from "@/features/common/components/kpi-stat";

interface KpiCardsRowProps {
  readonly kpis: ColaboratorKpi[];
  readonly dict: I18nRecord;
}

export default function KpiCardsRow({ kpis, dict }: KpiCardsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <KpiStat
          key={kpi.id}
          icon={{
            icon: kpi.icon,
            className: `${kpi.color} ${kpi.darkColor}`,
          }}
          title={{ text: tr(`kpi.${kpi.labelKey}`, dict), className: "whitespace-normal leading-tight text-xs" }}
          value={{ text: kpi.value, className: "text-xl" }}
          variant="horizontal"
          className="min-h-20 border-gray-200 dark:border-gray-700"
        />
      ))}
    </div>
  );
}
