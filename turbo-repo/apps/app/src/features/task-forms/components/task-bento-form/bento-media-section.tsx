"use client";

import { useState, useRef, useEffect } from "react";
import { HiExclamationTriangle } from "react-icons/hi2";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  ErrorBoundary,
  ErrorFallbackProps,
} from "@/features/common/components/error-boundary/error-boundary";
import Geographic from "@/features/shipping/components/geographic";
import FileImages from "./components/side-data/multimedia-manager.tsx/gallery/file-images";

// Contained fallback for the media panel. Defined at module scope (not inline in
// the parent) so it is a stable component — sonar typescript:S6478. `reset` is
// injected by ErrorBoundary; `dict` is supplied at the call site.
function MediaPanelErrorFallback({
  reset,
  dict,
}: ErrorFallbackProps & Readonly<{ dict: I18nDictionary }>) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
      <HiExclamationTriangle className="h-8 w-8 text-amber-500" />
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {tr("bento.multimedia.panel_error_title", dict)}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tr("bento.multimedia.panel_error_description", dict)}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        {tr("bento.multimedia.panel_error_retry", dict)}
      </button>
    </div>
  );
}

export default function BentoMediaSection({
  task,
  dict,
}: Readonly<{
  task: TaskResponse;
  dict: I18nDictionary;
}>) {
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMediaExpanded || !containerRef.current) return;
    containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isMediaExpanded]);

  return (
    <div
      ref={containerRef}
      className="flex w-full transition-all duration-500 ease-in-out"
      style={{ height: isMediaExpanded ? "min(95vh, 900px)" : "650px" }}
    >
      {/* Geographic — desktop only, collapses smoothly when viewer opens */}
      <div
        className="hidden lg:flex overflow-hidden bg-white dark:bg-gray-800 rounded-lg sm:border border-gray-300 dark:border-gray-700 transition-all duration-500 ease-in-out"
        style={{
          width: isMediaExpanded ? "0%" : "66.666%",
          marginRight: isMediaExpanded ? "0px" : "8px",
          opacity: isMediaExpanded ? 0 : 1,
          minWidth: 0,
        }}
      >
        <div className="h-full w-full">
          <Geographic
            task={task}
            dictionary={dict as unknown as Record<string, string>}
          />
        </div>
      </div>

      {/* FileImages — fills remaining space; on < lg the geographic is hidden so this becomes full width */}
      <div
        className="flex-1 overflow-hidden rounded-lg border scroll-p-6 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-500 ease-in-out"
        style={{ minWidth: 0 }}
      >
        <ErrorBoundary fallback={<MediaPanelErrorFallback dict={dict} />}>
          <FileImages
            task={task}
            dictionary={dict}
            isExpanded={isMediaExpanded}
            onRequestExpand={() => setIsMediaExpanded(true)}
            onRequestCollapse={() => setIsMediaExpanded(false)}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
