"use client";

import { useState } from "react";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ErrorBoundary } from "@/features/common/components/error-boundary/error-boundary";
import type { Milestone } from "../monitors/monitors-api";
import { LANE_VIEW } from "../board/board-api";
import { useTripSheet, type TripSheet as Sheet } from "./sheet-api";
import { DeliveriesPanel } from "../deliveries/deliveries-panel";
import { LiveBadge } from "../board/live-badge";
import { useBoardEvents } from "../board/use-board-events";
import { SheetHead } from "./sheet-head";
import { MilestoneChecklist, MilestoneModal } from "./milestone-checklist";
import { Alerts, Drivers, Progress, Tile, TripInfo } from "./sheet-tiles";
import { SheetTables } from "./sheet-tables";
import { TripMap } from "./trip-map";

function Bento({
  sheet,
  tripId,
  d,
  general,
  lang,
  aside,
}: Readonly<{
  sheet: Sheet;
  tripId: string;
  d: I18nRecord;
  general: I18nRecord;
  lang: string;
  aside: React.ReactNode;
}>) {
  const [open, setOpen] = useState<Milestone | null>(null);
  const twoDrivers = Boolean(sheet.card.secondDriver);
  return (
    <>
      <SheetHead sheet={sheet} d={d} onMilestone={setOpen} aside={aside} />
      <div className="grid h-fit grid-cols-1 gap-2 bg-gray-50 p-2 lg:grid-cols-5 dark:bg-gray-900">
        <div
          className={`col-span-1 flex flex-col gap-2 ${twoDrivers ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          <Tile className="flex-1">
            <TripInfo card={sheet.card} d={d} lang={lang} />
          </Tile>
          <Tile>
            <Progress sheet={sheet} d={d} />
          </Tile>
        </div>
        <Tile
          className={`col-span-1 ${twoDrivers ? "lg:col-span-2" : "lg:col-span-1"}`}
        >
          <Drivers card={sheet.card} d={d} />
        </Tile>
        <Tile className="col-span-1">
          <MilestoneChecklist
            sheet={sheet}
            d={d}
            lang={lang}
            onOpen={setOpen}
          />
        </Tile>

        <div className="col-span-1 flex gap-2 lg:col-span-5 lg:h-[560px]">
          <Tile className="hidden w-2/3 overflow-hidden lg:flex">
            <ErrorBoundary
              fallback={
                <p className="p-4 text-sm text-gray-500">{tr("error", d)}</p>
              }
            >
              <TripMap card={sheet.card} general={general} />
            </ErrorBoundary>
          </Tile>
          <Tile className="min-w-0 flex-1 overflow-auto">
            {sheet.deliveries ? (
              <DeliveriesPanel
                tripId={tripId}
                data={sheet.deliveries}
                d={d}
                lang={lang}
              />
            ) : (
              <p className="p-2 text-sm text-gray-500">
                {tr("sheet.deliveries.none", d)}
              </p>
            )}
          </Tile>
        </div>

        <div className="col-span-1 grid grid-cols-1 gap-2 lg:col-span-5 lg:grid-cols-6">
          <div className="col-span-1 min-h-[300px] overflow-hidden rounded-lg bg-white lg:col-span-4 lg:max-h-[520px] dark:bg-gray-800">
            <SheetTables
              transitions={sheet.transitions}
              stages={sheet.stages}
              feed={sheet.feed}
              d={d}
              lang={lang}
            />
          </div>
          <Tile className="col-span-1 overflow-hidden lg:col-span-2">
            <Alerts card={sheet.card} d={d} />
          </Tile>
        </div>
      </div>
      <MilestoneModal
        sheet={sheet}
        milestone={open}
        d={d}
        lang={lang}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/** One trip's page, laid out like the task bento: what the feed planned, what happened, and the milestones a person confirms. */
export default function TripSheet({
  tripId,
  lang,
  d,
  general,
}: Readonly<{
  tripId: string;
  lang: string;
  d: I18nRecord;
  general: I18nRecord;
}>) {
  const { data, error, isLoading } = useTripSheet(tripId);
  const live = useBoardEvents();
  const view = data ? LANE_VIEW[data.card.lane] : undefined;
  const aside = (
    <div className="flex items-center gap-3 px-2">
      <LiveBadge connected={live} d={d} />
      {view && (
        <Link
          href={`/${lang}/trips/${view}`}
          className="flex items-center gap-1 text-sm text-primary-700 hover:underline dark:text-primary-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          {trDynamic(`breadcrumb.${view}`, d)}
        </Link>
      )}
    </div>
  );
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="h-screen w-full overflow-auto bg-gray-50 dark:bg-gray-900">
        {error && (
          <p className="m-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {tr("error", d)}:{" "}
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        {isLoading && !data && (
          <p className="p-4 text-sm text-gray-500">{tr("loading", d)}</p>
        )}
        {data && (
          <Bento
            sheet={data}
            tripId={tripId}
            d={d}
            general={general}
            lang={lang}
            aside={aside}
          />
        )}
      </div>
    </div>
  );
}
