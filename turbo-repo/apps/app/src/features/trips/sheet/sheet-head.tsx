"use client";

import { useEffect, useState } from "react";
import { Button, Tooltip } from "flowbite-react";
import { GoClockFill } from "react-icons/go";
import { HiCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Milestone } from "../monitors/monitors-api";
import type { BoardCard } from "../board/board-api";
import { statusLabel } from "../board/trip-card";
import type { TripSheet } from "./sheet-api";
import { nextMilestone, useCanConfirm } from "./milestone-checklist";

/** `1d 4h 17m` between two instants. */
export function elapsed(from: string, to: Date) {
  const minutes = Math.max(
    0,
    Math.floor((to.getTime() - new Date(from).getTime()) / 60_000)
  );
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes % 60}m`);
  return parts.join(" ");
}

function Duration({ card, d }: Readonly<{ card: BoardCard; d: I18nRecord }>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const from = card.departedAt ?? card.plannedStart;
  if (!from) return null;
  const to = card.actualEnd ? new Date(card.actualEnd) : now;
  return (
    <Tooltip content={tr("sheet.duration", d)}>
      <div className="flex h-10 w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white p-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <GoClockFill className="h-5 w-5" />
        <span className="hidden whitespace-nowrap text-sm text-gray-900 lg:block dark:text-gray-100">
          {elapsed(from, to)}
        </span>
      </div>
    </Tooltip>
  );
}

/** The trip's title bar: where it is, how long it has run and the next milestone to act on. */
export function SheetHead({
  sheet,
  d,
  onMilestone,
  aside,
}: Readonly<{
  sheet: TripSheet;
  d: I18nRecord;
  onMilestone: (m: Milestone) => void;
  /** Shown before the duration: the live badge and the way back to the board. */
  aside?: React.ReactNode;
}>) {
  const { card } = sheet;
  const can = useCanConfirm(sheet);
  const next = nextMilestone(sheet.milestones);
  const action = next && can(next.milestone).canConfirm ? next : null;
  const name = (m: { milestone: Milestone }) =>
    trDynamic(`milestone.${m.milestone}`, d);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-md font-normal text-gray-700 dark:text-gray-200">
            {trDynamic(`lanes.${card.lane}`, d)}
          </h1>
          <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {card.codes.join(" · ") || card.tripId.slice(0, 8)}
          </span>
        </div>
        <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
          {tr("sheet.processState", d)}:{" "}
          <span className="font-normal text-gray-800 dark:text-gray-200">
            {statusLabel(card, d)}
          </span>
        </h2>
      </div>
      <div className="flex flex-row items-center gap-1">
        {aside}
        <Duration card={card} d={d} />
        {action && (
          <Button color="blue" onClick={() => onMilestone(action.milestone)}>
            <HiCheck className="mr-1 h-4 w-4" />
            {action.status === "pending"
              ? tr("sheet.nextConfirm", d, { milestone: name(action) })
              : tr("sheet.nextRecord", d, { milestone: name(action) })}
          </Button>
        )}
      </div>
    </div>
  );
}
