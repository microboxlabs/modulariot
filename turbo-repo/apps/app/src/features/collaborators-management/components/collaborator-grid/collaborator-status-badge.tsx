"use client";

import type { CollaboratorEmploymentStatus } from "../../types/collaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

const statusStyles: Record<CollaboratorEmploymentStatus, string> = {
  activo:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  suspendido:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  vacaciones:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

interface CollaboratorStatusBadgeProps {
  readonly status: CollaboratorEmploymentStatus;
  readonly dict: I18nRecord;
}

export default function CollaboratorStatusBadge({
  status,
  dict,
}: CollaboratorStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      {tr(`employmentStatus.${status}`, dict)}
    </span>
  );
}
