"use client";

import { useSearchParams } from "next/navigation";

export default function TimelineHeader() {
  const searchParams = useSearchParams();
  const loadId = searchParams.get("loadId");

  if (loadId === null) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-2 portrait:gap-2 flex flex-wrap items-center justify-between border-b border-gray-300 dark:border-gray-700">
      <h1 className="text-xl font-light text-gray-900 dark:text-gray-100 p-2">
        N°{loadId}
      </h1>
    </div>
  );
}
