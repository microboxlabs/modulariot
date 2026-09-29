/**
 * PROTOTYPE — the accepted/denied mock call-stats pair shown next to a
 * contact (contacts list row, dialing-step header, "who was called" readout
 * on the results form) — a colored pill per count, not bare icon+number, same
 * chip styling as the role badge next to a name.
 */

import { FaPhoneAlt } from "react-icons/fa";

export default function CallStatsBadges({
  accepted,
  denied,
}: {
  accepted: number;
  denied: number;
}) {
  return (
    <span className="flex items-center gap-1">
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
