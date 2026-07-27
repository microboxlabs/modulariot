"use client";

import { HiCheckCircle, HiXCircle } from "react-icons/hi2";
import type { RejectedItem, ObservationEntry, ApprovedItem } from "../task-bento-form/bento-review-context";

export function fmt(date: Date, locale: string): string {
  return new Date(date).toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ROW_STYLES = {
  approved: {
    rail: "border-l-green-500",
    tint: "bg-green-50/50 dark:bg-green-900/10",
    text: "text-green-700 dark:text-green-300",
    Icon: HiCheckCircle,
  },
  rejected: {
    rail: "border-l-red-500",
    tint: "bg-red-50/50 dark:bg-red-900/10",
    text: "text-red-700 dark:text-red-300",
    Icon: HiXCircle,
  },
} as const;

/**
 * One reviewed document, as a row rather than a card.
 *
 * <p>Verdict is carried by a coloured left rail and an icon, so a reviewer scanning
 * the modal sees the shape of the outcome — a block of red, a block of green —
 * without reading a word. The nested bordered cards this replaced put three box
 * outlines between the reader and the file name.
 */
export function ReviewedItemRow({
  item,
  status,
  locale,
  noObservationsLabel,
}: Readonly<{
  item: ApprovedItem | RejectedItem;
  status: "approved" | "rejected";
  locale: string;
  noObservationsLabel?: string;
}>) {
  const s = ROW_STYLES[status];
  // The reasons lead: they are the codes the partner receives. The free text below
  // is supporting detail, and arrives already resolved to labels.
  const reasons = item.reasons;

  return (
    <li className={`list-none border-l-2 ${s.rail} ${s.tint} pl-3 pr-2 py-2`}>
      <div className="flex items-center gap-2">
        <s.Icon className={`w-4 h-4 shrink-0 ${s.text}`} />
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {item.fileName}
        </span>
      </div>

      {reasons.length > 0 && (
        <div className="mt-1.5 ml-6 flex flex-wrap gap-1">
          {reasons.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center rounded bg-white/70 dark:bg-gray-800/60 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-600"
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {item.observations.map((obs) => (
        <ObservationNote key={obs.id} obs={obs} locale={locale} />
      ))}

      {item.observations.length === 0 && noObservationsLabel && (
        <p className="mt-1 ml-6 text-xs italic text-gray-400 dark:text-gray-500">
          {noObservationsLabel}
        </p>
      )}
    </li>
  );
}

function ObservationNote({ obs, locale }: Readonly<{ obs: ObservationEntry; locale: string }>) {
  return (
    <div className="mt-1.5 ml-6 flex flex-col gap-0.5">
      <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">{obs.description}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {[obs.createdBy, fmt(obs.createdAt, locale)].filter(Boolean).join(" · ")}
      </p>
      {obs.replies?.map((reply) => (
        <div key={reply.id} className="mt-1 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{reply.description}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {[reply.createdBy, fmt(reply.createdAt, locale)].filter(Boolean).join(" · ")}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * The whole review outcome in one container: a count strip, then every document as
 * a row. Rejected leads, because it is what the reviewer is being asked to confirm.
 */
export function ReviewSummary({
  approvedItems,
  rejectedItems,
  locale,
  approvedCountLabel,
  rejectedCountLabel,
  noObservationsLabel,
}: Readonly<{
  approvedItems: ApprovedItem[];
  rejectedItems: RejectedItem[];
  locale: string;
  approvedCountLabel: string;
  rejectedCountLabel: string;
  noObservationsLabel?: string;
}>) {
  if (approvedItems.length === 0 && rejectedItems.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
        {rejectedItems.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
            <HiXCircle className="w-4 h-4" />
            {rejectedCountLabel}
          </span>
        )}
        {approvedItems.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-300">
            <HiCheckCircle className="w-4 h-4" />
            {approvedCountLabel}
          </span>
        )}
      </div>

      <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {rejectedItems.map((item) => (
          <ReviewedItemRow
            key={item.fileName}
            item={item}
            status="rejected"
            locale={locale}
            noObservationsLabel={noObservationsLabel}
          />
        ))}
        {approvedItems.map((item) => (
          <ReviewedItemRow
            key={item.fileName}
            item={item}
            status="approved"
            locale={locale}
          />
        ))}
      </ul>
    </div>
  );
}
