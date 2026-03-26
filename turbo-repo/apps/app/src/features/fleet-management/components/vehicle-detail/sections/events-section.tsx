"use client";

import {
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { InfoRow } from "@/features/common/components/info-row";

interface EventsSectionProps {
  readonly dict: I18nRecord;
}

export default function EventsSection({ dict }: EventsSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineExclamationTriangle}
      title={tr("vehicleDetail.sections.events.title", dict)}
      description={tr("vehicleDetail.sections.events.description", dict)}
    >
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <HiOutlineExclamationTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tr("vehicleDetail.sections.events.hardBraking", dict)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("vehicleDetail.sections.events.hoursAgo", dict, { count: 3 })}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <HiOutlineCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tr("vehicleDetail.sections.events.routeCompleted", dict)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("vehicleDetail.sections.events.hoursAgo", dict, { count: 5 })}
            </span>
          </div>
        </div>
        <InfoRow
          label={tr("vehicleDetail.sections.events.incidentsThisMonth", dict)}
          value="2"
        />
      </div>
    </ExpandableSection>
  );
}
