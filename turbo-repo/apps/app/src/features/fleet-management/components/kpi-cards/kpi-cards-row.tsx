"use client";

import type { FleetKpi } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { KpiStat } from "@/features/common/components/kpi-stat";

interface KpiCardsRowProps {
  readonly kpis: FleetKpi[];
  readonly dict: I18nRecord;
}

export default function KpiCardsRow({ kpis, dict }: KpiCardsRowProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
      {kpis.map((kpi) => (
        <KpiStat
          key={kpi.id}
          icon={{
            icon: kpi.icon,
            className: `${kpi.color} ${kpi.darkColor}`,
          }}
          title={{ text: tr(`kpi.${kpi.labelKey}`, dict) }}
          value={{ text: kpi.value }}
          variant="horizontal"
          className="min-w-45 flex-1 text-2xl"
        />
      ))}
    </div>
  );
}
