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
  return (
    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
      {tr("taskCounter.activeCount", dict, { count: count.toString() })}
    </div>
  );
}
