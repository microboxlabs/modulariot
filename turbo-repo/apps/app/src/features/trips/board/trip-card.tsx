"use client";

import { HiArrowRight, HiExclamation } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { BoardCard, MilestoneStatus } from "./board-api";

const MILESTONES = ["departure", "arrival", "closure"] as const;

const MILESTONE_STYLE: Record<MilestoneStatus, string> = {
  open: "bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-300",
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export function shortTime(iso: string | null, lang: string) {
  return iso
    ? new Date(iso).toLocaleString(lang, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;
}

function Times({
  card,
  d,
  lang,
}: Readonly<{ card: BoardCard; d: I18nRecord; lang: string }>) {
  const finished = card.status === "completed" || card.status === "cancelled";
  const rows: [string, string | null][] = finished
    ? [
        ["card.departed", shortTime(card.departedAt, lang)],
        ["card.ended", shortTime(card.actualEnd ?? card.updatedAt, lang)],
      ]
    : [
        [
          card.departedAt ? "card.departed" : "card.departure",
          shortTime(card.departedAt ?? card.plannedStart, lang),
        ],
        [
          card.arrivedAt ? "card.arrived" : "card.arrival",
          shortTime(card.arrivedAt ?? card.plannedArrival, lang),
        ],
      ];
  return (
    <dl className="grid grid-cols-2 gap-x-2 text-xs">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt className="text-gray-500 dark:text-gray-400">
            {trDynamic(key, d)}
          </dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const TRIP_STATUSES = new Set([
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

/** The tenant's service status, or the trip's own status in the user's language when the plan names none. */
export function statusLabel(
  card: Pick<BoardCard, "label" | "status">,
  d: I18nRecord
) {
  const label = card.label ?? card.status;
  return TRIP_STATUSES.has(label) ? trDynamic(`tripStatus.${label}`, d) : label;
}

/** A trip on the board: its service, route, resources, times and milestones. */
export function TripCard({
  card,
  d,
  lang,
  compact,
}: Readonly<{
  card: BoardCard;
  d: I18nRecord;
  lang: string;
  compact: boolean;
}>) {
  const code = card.codes.join(" · ") || card.tripId.slice(0, 8);
  const route = [card.origin, card.destination];
  const overdue = card.alerts.some((a) => a.endsWith("_overdue"));
  return (
    <div
      className={`block rounded-lg bg-white shadow dark:bg-gray-700 ${
        compact ? "px-2 py-1.5" : "space-y-3 p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <strong
          className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100"
          style={{ fontVariantNumeric: "tabular-nums" }}
          title={code}
        >
          {code}
        </strong>
        <div className="flex shrink-0 items-center gap-1">
          {overdue && (
            <span title={tr("card.overdue", d)}>
              <HiExclamation className="h-4 w-4 text-amber-500" />
            </span>
          )}
          {!compact && (
            <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary-800 dark:bg-primary-900/50 dark:text-primary-300">
              {statusLabel(card, d)}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <>
          <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            <span className="min-w-0 truncate" title={route[0] ?? undefined}>
              {route[0] ?? "—"}
            </span>
            <HiArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="min-w-0 truncate" title={route[1] ?? undefined}>
              {route[1] ?? "—"}
            </span>
          </div>
          <div className="space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
            <div>
              <span className="font-medium">
                {card.truck ?? tr("card.noTruck", d)}
              </span>
              {card.trailer && (
                <span className="text-gray-500"> · {card.trailer}</span>
              )}
            </div>
            <div className="truncate" title={card.carrier ?? undefined}>
              {card.driver ?? tr("card.noDriver", d)}
              {card.secondDriver && ` · ${card.secondDriver}`}
            </div>
            {card.carrier && (
              <div className="truncate text-gray-500" title={card.carrier}>
                {card.carrier}
              </div>
            )}
          </div>
          <Times card={card} d={d} lang={lang} />
          <div className="flex flex-wrap gap-1">
            {MILESTONES.map((m) => {
              const status = card.milestones[m] ?? "open";
              return (
                <span
                  key={m}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${MILESTONE_STYLE[status]}`}
                  title={`${tr(`milestone.${m}`, d)}: ${tr(`milestoneStatus.${status}`, d)}`}
                >
                  {tr(`milestone.${m}`, d)}
                </span>
              );
            })}
            {card.regularized && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                {tr("lanes.regularized", d)}
              </span>
            )}
          </div>
          {card.cancelReason && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {card.cancelReason}
            </p>
          )}
        </>
      )}
    </div>
  );
}
