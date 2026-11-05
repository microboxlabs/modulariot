import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import { statusTone, type StatusTone } from "./meta-template-model";

const TONE: Record<StatusTone, string> = {
  green:
    "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400",
  blue: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  red: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400",
  gray: "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const LABEL: Record<string, string> = {
  APPROVED: "metaStatusApproved",
  PENDING: "metaStatusPending",
  REJECTED: "metaStatusRejected",
  PAUSED: "metaStatusPaused",
  DISABLED: "metaStatusDisabled",
  IN_APPEAL: "metaStatusInAppeal",
};

/** A template's review state on Meta, in words. */
export function metaStatusLabel(status: string, d: I18nRecord) {
  const key = LABEL[status];
  return key ? trDynamic(key, d) : status;
}

/** A template's review state on Meta as a chip. */
export default function MetaStatusChip({
  status,
  d,
}: Readonly<{ status: string; d: I18nRecord }>) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[statusTone(status)]}`}
    >
      {metaStatusLabel(status, d)}
    </span>
  );
}
