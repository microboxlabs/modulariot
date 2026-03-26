"use client";

import type { FleetKpi } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import KpiCard from "./kpi-card";

interface KpiCardsRowProps {
  readonly kpis: FleetKpi[];
  readonly dict: I18nRecord;
}

export default function KpiCardsRow({ kpis, dict }: KpiCardsRowProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} dict={dict} />
      ))}
    </div>
  );
}
