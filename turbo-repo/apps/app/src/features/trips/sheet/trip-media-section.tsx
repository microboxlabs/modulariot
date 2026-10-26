"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ErrorBoundary } from "@/features/common/components/error-boundary/error-boundary";
import FileImages from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/gallery/file-images";
import type { BoardCard } from "../board/board-api";
import { createTripsSource } from "../documents/documents-api";
import { TripMap } from "./trip-map";

/** The map and the trip's multimedia side by side; opening a file hides the map and gives the viewer the row. */
export function TripMediaSection({
  card,
  general,
  d,
  lang,
}: Readonly<{
  card: BoardCard;
  general: I18nRecord;
  d: I18nRecord;
  lang: string;
}>) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const source = useMemo(
    () => createTripsSource(card.tripId, lang),
    [card.tripId, lang]
  );

  useEffect(() => {
    if (expanded)
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [expanded]);

  return (
    <div
      ref={ref}
      className="flex w-full transition-all duration-500 ease-in-out"
      style={{ height: expanded ? "min(95vh, 900px)" : "560px" }}
    >
      <div
        className="hidden overflow-hidden rounded-lg border border-gray-300 bg-white transition-all duration-500 ease-in-out lg:flex dark:border-gray-700 dark:bg-gray-800"
        style={{
          width: expanded ? "0%" : "66.666%",
          marginRight: expanded ? "0px" : "8px",
          opacity: expanded ? 0 : 1,
          minWidth: 0,
        }}
      >
        <ErrorBoundary
          fallback={
            <p className="p-4 text-sm text-gray-500">{tr("error", d)}</p>
          }
        >
          <TripMap card={card} general={general} />
        </ErrorBoundary>
      </div>
      <div
        className="flex-1 overflow-hidden rounded-lg border border-gray-300 bg-white transition-all duration-500 ease-in-out dark:border-gray-700 dark:bg-gray-800"
        style={{ minWidth: 0 }}
      >
        <ErrorBoundary
          fallback={
            <p className="p-4 text-sm text-gray-500">{tr("error", d)}</p>
          }
        >
          <FileImages
            task={null}
            source={source}
            dictionary={general}
            isExpanded={expanded}
            onRequestExpand={() => setExpanded(true)}
            onRequestCollapse={() => setExpanded(false)}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
