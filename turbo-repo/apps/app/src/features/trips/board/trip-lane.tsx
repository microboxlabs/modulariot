"use client";

import { Tooltip } from "flowbite-react";
import { HiChevronDoubleLeft } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { TaskCounter } from "@/features/shipping/components/TaskCounter";
import type { LaneViewState } from "@/features/shipping/hooks/use-lane-view-state";
import type { BoardLane } from "./board-api";
import { TripCard } from "./trip-card";

/** One lane of the trips board, with the same panel, counter and collapse as the task board's lanes. */
export function TripLane({
  lane,
  d,
  lang,
  compact,
  laneState,
  onLaneUpdate,
}: Readonly<{
  lane: BoardLane;
  d: I18nRecord;
  lang: string;
  compact: boolean;
  laneState: LaneViewState;
  onLaneUpdate: (patch: Partial<LaneViewState>) => void;
}>) {
  const title = tr(`lanes.${lane.key}`, d);

  if (laneState.collapsed) {
    return (
      <Tooltip content={tr("kanban.lane.expand", d)}>
        <button
          type="button"
          onClick={() => onLaneUpdate({ collapsed: false })}
          className="flex w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg bg-gray-100 p-2 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
          aria-label={tr("kanban.lane.expand", d)}
        >
          <TaskCounter count={lane.count} dict={d} />
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-gray-700 [writing-mode:vertical-rl] dark:text-gray-300">
            {title}
          </span>
        </button>
      </Tooltip>
    );
  }

  return (
    <section
      aria-label={title}
      className={`flex shrink-0 flex-col rounded-lg bg-gray-100 p-3 dark:bg-gray-800 ${
        compact ? "w-44" : "w-[280px]"
      }`}
    >
      <div className="sticky top-0 z-20 mb-2.5 flex min-h-[2.5rem] items-center justify-between gap-2 bg-gray-100 dark:bg-gray-800">
        <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold uppercase leading-tight tracking-wide text-gray-700 dark:text-gray-300">
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <TaskCounter count={lane.count} dict={d} />
          <button
            type="button"
            onClick={() => onLaneUpdate({ collapsed: true })}
            className="cursor-pointer rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label={tr("kanban.lane.collapse", d)}
            title={tr("kanban.lane.collapse", d)}
          >
            <HiChevronDoubleLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"}`}>
        {lane.cards.map((card) => (
          <TripCard
            key={card.tripId}
            card={card}
            d={d}
            lang={lang}
            compact={compact}
          />
        ))}
        {lane.cards.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            {tr("empty", d)}
          </p>
        )}
        {lane.count > lane.cards.length && (
          <p className="pt-1 text-center text-xs text-gray-500">
            {tr("more", d, {
              shown: String(lane.cards.length),
              count: String(lane.count),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
