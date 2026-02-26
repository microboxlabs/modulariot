"use client";

import type { VehicleStatus } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const statusStyles: Record<VehicleStatus, string> = {
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  maintenance:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  alert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  inactive:
    "bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400",
};

interface VehicleStatusBadgeProps {
  readonly status: VehicleStatus;
  readonly dict: I18nRecord;
}

export default function VehicleStatusBadge({
  status,
  dict,
}: VehicleStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      {tr(`status.${status}`, dict)}
    </span>
  );
}
