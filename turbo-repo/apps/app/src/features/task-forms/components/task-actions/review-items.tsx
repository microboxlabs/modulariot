"use client";

import { HiCheckCircle, HiDocumentText } from "react-icons/hi2";
import type { RejectedItem, ObservationEntry, ApprovedItem } from "../task-bento-form/bento-review-context";

export function fmt(date: Date, locale: string): string {
  return new Date(date).toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const ITEM_STYLES = {
  approved: {
    border: "border-green-200 dark:border-green-800",
    header: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-300",
    Icon: HiCheckCircle,
    iconColor: "text-green-500",
  },
  rejected: {
    border: "border-red-200 dark:border-red-800",
    header: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    Icon: HiDocumentText,
    iconColor: "text-red-500",
  },
} as const;

export function ObservationCard({ obs, locale }: Readonly<{ obs: ObservationEntry; locale: string }>) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {obs.createdBy && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{obs.createdBy}</span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmt(obs.createdAt, locale)}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{obs.description}</p>
      {obs.replies && obs.replies.length > 0 && (
        <div className="flex flex-col gap-2 mt-0.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          {obs.replies.map((reply) => (
            <div key={reply.id} className="flex flex-col gap-0.5 rounded px-1.5 py-1 -mx-1.5">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{reply.description}</p>
              <div className="flex items-center gap-1.5">
                {reply.createdBy && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{reply.createdBy}</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(reply.createdAt, locale)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewedItemCard({
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
  const s = ITEM_STYLES[status];
  const hasBody = item.observations.length > 0 || !!noObservationsLabel;
  return (
    <li className={`rounded-lg border ${s.border} overflow-hidden list-none`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${s.header} ${hasBody ? "border-b" : ""}`}>
        <s.Icon className={`w-3.5 h-3.5 ${s.iconColor} shrink-0`} />
        <span className={`text-xs font-medium ${s.text} truncate`}>{item.fileName}</span>
      </div>
      {item.observations.length > 0 ? (
        <div className="flex flex-col gap-2 p-3">
          {item.observations.map((obs) => (
            <ObservationCard key={obs.id} obs={obs} locale={locale} />
          ))}
        </div>
      ) : (
        noObservationsLabel && (
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
            {noObservationsLabel}
          </p>
        )
      )}
    </li>
  );
}

export function ReviewSection({
  items,
  status,
  countLabel,
  locale,
  noObservationsLabel,
}: Readonly<{
  items: (ApprovedItem | RejectedItem)[];
  status: "approved" | "rejected";
  countLabel: string;
  locale: string;
  noObservationsLabel?: string;
}>) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{countLabel}</p>
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <ReviewedItemCard
            key={item.fileName}
            item={item}
            status={status}
            locale={locale}
            noObservationsLabel={noObservationsLabel}
          />
        ))}
      </ul>
    </div>
  );
}
