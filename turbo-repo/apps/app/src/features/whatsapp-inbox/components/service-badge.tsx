import { HiOutlineTag } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/**
 * Compact pill showing the service code a thread belongs to. Under the per-service model each
 * conversation IS a service thread, so this is the thread's identity — shown on the list row and in
 * the thread header so an operator always knows which service a message is about.
 */
export default function ServiceBadge({
  code,
  dict,
}: {
  readonly code: string;
  readonly dict: I18nRecord;
}) {
  const label = `${tr("serviceLabel", dict)}: ${code}`;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
      title={label}
      aria-label={label}
    >
      <HiOutlineTag className="h-3 w-3" aria-hidden />
      {code}
    </span>
  );
}
