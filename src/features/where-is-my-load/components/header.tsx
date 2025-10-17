import Link from "next/link";
import React from "react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ChevronLeft } from "flowbite-react-icons/outline";

export default function TimelineHeader({
  dict,
  searchParams,
}: {
  dict: I18nRecord;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const expedition_code = searchParams?.expeditionCode as string | null;
  const expedition_number = searchParams?.expeditionNumber as string | null;

  if (!expedition_code && !expedition_number) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-2 flex flex-wrap items-center justify-center md:justify-start border-b border-gray-300 dark:border-gray-700">
      <Link
        className="text-gray-700 hover:text-gray-500 dark:text-gray-200 dark:hover:text-gray-400 rounded-full flex p-2"
        href="/where-is-my-load"
      >
        <ChevronLeft className="h-7 w-7" />
      </Link>
      <span className="text-xl font-light text-gray-700 dark:text-gray-200 py-2 flex flex-row">
        {tr("wheres_my_load.timeline", dict)}
        {(expedition_code || expedition_number) && (
          <span>: N°{expedition_code || expedition_number}</span>
        )}
      </span>
    </div>
  );
}
