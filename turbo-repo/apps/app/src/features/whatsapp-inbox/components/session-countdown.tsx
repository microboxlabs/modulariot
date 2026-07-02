import { HiOutlineClock } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { formatRemaining, type WindowState, type WindowStatus } from "../session-window";

const STYLES: Record<WindowStatus, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  closingSoon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  closed: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const LABEL_KEY: Record<WindowStatus, string> = {
  open: "windowOpen",
  closingSoon: "windowClosingSoon",
  closed: "windowClosed",
};

/**
 * Header pill for the 24h reply window: green while comfortably open (with a live `Hh Mm` countdown),
 * amber in the last 2h, grey once closed. Purely presentational — {@link useSessionWindow} owns the
 * clock.
 */
export default function SessionCountdown({
  state,
  dict,
}: {
  readonly state: WindowState;
  readonly dict: I18nRecord;
}) {
  const label =
    state.status === "closed"
      ? tr("windowClosed", dict)
      : `${tr(LABEL_KEY[state.status], dict)} · ${formatRemaining(state.remainingMs)}`;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STYLES[state.status]}`}
      title={tr("windowHint", dict)}
    >
      <HiOutlineClock className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
