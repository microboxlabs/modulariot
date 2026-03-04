"use client";

import type { FleetKpi } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface KpiCardProps {
  readonly kpi: FleetKpi;
  readonly dict: I18nRecord;
}

export default function KpiCard({ kpi, dict }: KpiCardProps) {
  const Icon = kpi.icon;

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-w-[180px] flex-1">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-lg ${kpi.color} ${kpi.darkColor}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {kpi.value}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr(`kpi.${kpi.labelKey}`, dict)}
        </span>
      </div>
    </div>
  );
}
