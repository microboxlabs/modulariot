"use client";

import { useState } from "react";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { I18nDictionary, I18nRecord } from "@/features/i18n/i18n.service.types";
import Geographic from "@/features/shipping/components/geographic";
import FileImages from "./components/side-data/multimedia-manager.tsx/file-images";

export default function BentoMediaSection({
  task,
  dict,
}: {
  task: TaskResponse;
  dict: I18nDictionary;
}) {
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);

  return (
    <div className="flex gap-2 w-full" style={{ height: "650px" }}>
      {/* Geographic — desktop only, collapses smoothly when viewer opens */}
      <div
        className="hidden lg:flex overflow-hidden bg-white dark:bg-gray-800 rounded-lg sm:border border-gray-300 dark:border-gray-700 transition-all duration-500 ease-in-out"
        style={{
          width: isMediaExpanded ? "0%" : "66.666%",
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

      {/* FileImages — expands to fill geographic space */}
      <div
        className="p-2 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-500 ease-in-out"
        style={{
          width: isMediaExpanded ? "100%" : "33.333%",
          minWidth: 0,
        }}
      >
        <FileImages
          task={task}
          dictionary={dict as I18nRecord}
          isExpanded={isMediaExpanded}
          onRequestExpand={() => setIsMediaExpanded(true)}
          onRequestCollapse={() => setIsMediaExpanded(false)}
        />
      </div>
    </div>
  );
}
