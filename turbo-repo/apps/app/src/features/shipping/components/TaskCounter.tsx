import React from "react";
import { tr } from "@/features/i18n/tr.service";
import { PropsWithI18nDict } from "@/features/i18n/i18n.service.types";

export type TaskCounterProps = {
  count: number;
};

export function TaskCounter({
  count,
  dict,
}: PropsWithI18nDict<TaskCounterProps>) {
  const label = tr("taskCounter.activeCount", dict, { count: count.toString() });
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
    >
      {count}
    </span>
  );
}
