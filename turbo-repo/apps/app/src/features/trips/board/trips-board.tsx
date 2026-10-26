"use client";

import { useSearchParams } from "next/navigation";
import { HiTruck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { CompactKanbanViewSwitcher } from "@/features/common/components/view-switcher/compact-kanban-view-switcher";
import { useCompactViewPreference } from "@/features/shipping/hooks/use-compact-view-preference";
import { useLaneViewState } from "@/features/shipping/hooks/use-lane-view-state";
import { useTripsBoard, type BoardViewKey } from "./board-api";
import { TripLane } from "./trip-lane";

/** One page of the trips board: the lanes of `view`, refreshed every 30 seconds. */
export default function TripsBoard({
  view,
  lang,
  d,
  general,
}: Readonly<{
  view: BoardViewKey;
  lang: string;
  d: I18nRecord;
  general: I18nRecord;
}>) {
  const searchParams = useSearchParams();
  const { data, error, isLoading } = useTripsBoard(view, searchParams);
  const [compact, setCompact] = useCompactViewPreference(false);
  const { getLaneState, updateLaneState } = useLaneViewState();
  const total = data?.lanes.reduce((sum, lane) => sum + lane.count, 0) ?? 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <SectionHeader
        path={["breadcrumb.trips", `breadcrumb.${view}`]}
        rootIcon={<HiTruck className="mr-2 h-4 w-4" />}
        breadcrumbDict={d}
        filterDict={general}
        lang={lang}
        rightContent={
          <div className="flex items-center gap-1">
            {data && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-[3px] text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {tr("count", d, { count: String(total) })}
              </span>
            )}
            <CompactKanbanViewSwitcher
              kanbanView
              activeView={compact}
              onViewChange={setCompact}
              dict={d}
            />
          </div>
        }
      />
      <div className="isolate h-screen w-full overflow-auto bg-gray-50 dark:bg-gray-900">
        {error && (
          <p className="m-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {tr("error", d)}:{" "}
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        {isLoading && !data && (
          <p className="m-4 text-sm text-gray-500">{tr("loading", d)}</p>
        )}
        {data && (
          <div
            className={`flex items-start justify-start py-4 ${compact ? "mx-2 gap-2" : "mx-4 gap-4"}`}
          >
            {data.lanes.map((lane) => (
              <TripLane
                key={lane.key}
                lane={lane}
                d={d}
                lang={lang}
                compact={compact}
                laneState={getLaneState(`trips.${lane.key}`)}
                onLaneUpdate={(patch) =>
                  updateLaneState(`trips.${lane.key}`, patch)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
