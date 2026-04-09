"use client";

import type { Collaborator } from "../../types/collaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { 
  HiClipboardList, 
  HiOutlineChevronLeft, 
  HiOutlineChevronRight,
  HiOutlineTruck,
  HiOutlineStar,
  HiOutlineExclamationCircle,
} from "react-icons/hi";

const statusStyles: Record<string, string> = {
  activo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  suspendido: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  vacaciones: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

interface CollaboratorDetailHeaderProps {
  readonly collaborator: Collaborator;
  readonly dict: I18nRecord;
  readonly previous: {
    hasPrevious: boolean;
    onPrevious: () => void;
  };
  readonly next: {
    hasNext: boolean;
    onNext: () => void;
  };

}

export default function CollaboratorDetailHeader({
  collaborator,
  dict,
  previous,
  next,
}: CollaboratorDetailHeaderProps) {
  const initials = collaborator.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white dark:bg-gray-800 p-4 flex flex-col gap-3 border-b border-gray-200 dark:border-gray-700 w-full">
      <ClientBreadcrumb
        path={[
          { label: "breadcrumb.collaboratorsManagement", href: "/collaborators-management" },
          collaborator.name,
        ]}
        rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
        dict={dict}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
              {initials}
            </span>
          </div>

          {/* Details row */}
          <div className="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto">
            {/* Name */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("detail.name", dict)}
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {collaborator.name}
              </span>
            </div>

            {/* Role/Rank */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("detail.role", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {tr(`rank.${collaborator.rank}`, dict)}
              </span>
            </div>

            {/* Status */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("detail.status", dict)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[collaborator.employmentStatus]}`}>
                {tr(`employmentStatus.${collaborator.employmentStatus}`, dict)}
              </span>
            </div>

            {/* Vehicle (if assigned) */}
            {collaborator.assignedVehiclePlate && (
              <div className="flex flex-col shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {tr("detail.vehicle", dict)}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                  <HiOutlineTruck className="w-4 h-4" />
                  {collaborator.assignedVehiclePlate}
                </span>
              </div>
            )}

            
          </div>
        </div>
        <div className="flex flex-row gap-1">
          {/* Achievements */}
          {collaborator.achievements?.map((achievement) => (
            <span
              key={achievement}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0"
            >
              <HiOutlineStar className="w-3 h-3" />
              {tr(`achievement.${achievement}`, dict)}
            </span>
          ))}

          {/* Alerts */}
          {collaborator.alerts?.map((alert) => (
            <span
              key={alert}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0"
            >
              <HiOutlineExclamationCircle className="w-3 h-3" />
              {tr(`alert.${alert}`, dict)}
            </span>
          ))}
        </div>
        {/* Right: Navigation buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={previous.onPrevious}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("detail.previous", dict)}
            disabled={!previous.hasPrevious}
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            type="button"
            onClick={next.onNext}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("detail.next", dict)}
            disabled={!next.hasNext}
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
