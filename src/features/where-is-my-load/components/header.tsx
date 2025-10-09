"use client";

import { useSearchParams } from "next/navigation";
import React from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export default function TimelineHeader({ dict }: { dict: I18nRecord }) {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("loadId");

  if (loadId === null) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-center md:justify-start border-b border-gray-300 dark:border-gray-700">
      <h1 className="text-xl font-light text-gray-700 dark:text-gray-200 p-2">
        {tr("wheres_my_load.timeline", dict)}:{" "}
        <span className="">N°{loadId}</span>
      </h1>
    </div>
  );
}
