"use client";

/**
 * One row of the "Treatments" box's per-call breakdown, styled after the
 * "a quién llamar" contact row (`call-center-menu.tsx`): status + method on
 * the left, when it happened on the right. Read-only; one recorded CALL
 * action from the Control Tower API.
 */

import { FaPhoneAlt } from "react-icons/fa";
import { FormattedDate } from "@/features/common/components/formatted-date";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import CopyButton from "./copy-button";
import { CALL_METHOD_ICONS, CALL_METHOD_LABEL_KEYS } from "./call-method";
import { formatCallLogDuration, type CallLogEntry } from "./call-log";

export default function CallLogRow({
  dict,
  entry,
  roundedBottom = false,
  highlighted = false,
}: {
  dict: I18nRecord;
  entry: CallLogEntry;
  /** True for the very last row rendered in a "Tratamiento" card — matches
   *  the card's own `rounded-md` so the hover border (and the card's
   *  `overflow-hidden` clip) follow the rounded corner instead of visibly
   *  cutting a square-cornered border off at an angle. */
  roundedBottom?: boolean;
  /** Driven by the wrapping tooltip's own `open` state instead of CSS
   *  `:hover` — `:hover` doesn't know about the tooltip's scroll-close
   *  behavior, so it could stay lit after a scroll force-closes the
   *  tooltip while the cursor never actually left the row. */
  highlighted?: boolean;
}) {
  const t = (k: string) => tr(`symptoms.${k}`, dict);
  const MethodIcon = CALL_METHOD_ICONS[entry.method];
  const when = entry.at;
  const outcomeText =
    entry.outcome === "answered"
      ? formatCallLogDuration(entry.durationSeconds)
      : t("call_log_missed");

  const getCopyText = () => {
    const lines = [
      `${entry.calledName} — ${t(CALL_METHOD_LABEL_KEYS[entry.method])} (${outcomeText})`,
      formatDateString(when, "datetime"),
    ];
    if (entry.message) lines.push(`${t("message")}: ${entry.message}`);
    if (entry.response) lines.push(`${t("response")}: ${entry.response}`);
    return lines.join("\n");
  };

  return (
    <div
      className={`flex w-full items-center justify-between gap-2 border-x border-b bg-gray-50 px-2 py-1.5 transition-colors dark:bg-gray-800/50 ${
        highlighted ? "border-white" : "border-transparent"
      } ${roundedBottom ? "rounded-b-md" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            entry.outcome === "answered"
              ? "bg-green-500/20 text-green-700 dark:text-green-400"
              : "bg-red-500/20 text-red-600 dark:text-red-400"
          }`}
        >
          <FaPhoneAlt className="h-2.5 w-2.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
            {entry.calledName}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <MethodIcon className="h-2.5 w-2.5" />
            {t(CALL_METHOD_LABEL_KEYS[entry.method])}
            <span>·</span>
            {outcomeText}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          <FormattedDate date={when} format="time" />
        </span>
        <CopyButton dict={dict} getText={getCopyText} />
      </div>
    </div>
  );
}
