/**
 * The answered/missed call counts shown next to a
 * contact, for the current case (contacts list row, dialing-step header, "who was called" readout
 * on the results form) — a colored pill per count, not bare icon+number, same
 * chip styling as the role badge next to a name.
 */

import { FaPhoneAlt } from "react-icons/fa";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { CallStats } from "./call-targets";

/** The badges' tooltip: the counts in this case, then the contact's counts in all cases. */
export function callStatsTitle(
  stats: CallStats | null | undefined,
  history: CallStats | null | undefined,
  dict: I18nRecord
): string | undefined {
  const counts = (s: CallStats) => ({
    answered: String(s.accepted),
    missed: String(s.denied),
  });
  const lines = [
    stats && tr("symptoms.call_center_stats_case", dict, counts(stats)),
    history && tr("symptoms.call_center_stats_all", dict, counts(history)),
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export default function CallStatsBadges({
  accepted,
  denied,
  title,
}: Readonly<{
  accepted: number;
  denied: number;
  /** What the counts are: this case, all cases, or both. */
  title?: string;
}>) {
  return (
    <span className="flex items-center gap-1" title={title}>
      <span className="flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-500/20 dark:text-green-400">
        <FaPhoneAlt className="h-2.5 w-2.5" />
        {accepted}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">
        <FaPhoneAlt className="h-2.5 w-2.5" />
        {denied}
      </span>
    </span>
  );
}
