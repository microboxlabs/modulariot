"use client";

import { useState, useRef, useEffect } from "react";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary } from "@/features/i18n/i18n.service.types";
import Geographic from "@/features/shipping/components/geographic";
import FileImages from "./components/side-data/multimedia-manager.tsx/gallery/file-images";

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
        <FileImages
          task={task}
          dictionary={dict}
          isExpanded={isMediaExpanded}
          onRequestExpand={() => setIsMediaExpanded(true)}
          onRequestCollapse={() => setIsMediaExpanded(false)}
        />
      </div>
    </div>
  );
}
