"use client";

import type { ComponentProps, FC } from "react";
import { HiOutlineRectangleGroup, HiOutlineSquaresPlus } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

type T = (key: string) => string;

function Option({
  icon: Icon,
  title,
  body,
  badge,
  onSelect,
}: Readonly<{
  icon: FC<ComponentProps<"svg">>;
  title: string;
  body: string;
  badge?: string;
  onSelect?: () => void;
}>) {
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={onSelect}
      className={twMerge(
        "group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
        onSelect
          ? "border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
          : "cursor-not-allowed border-dashed border-gray-200 opacity-70 dark:border-gray-700"
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          <Icon className="h-5 w-5" />
        </span>
        {badge && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {badge}
          </span>
        )}
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{body}</span>
    </button>
  );
}

/** Start with one dashlet, or (later) from a ready-made template. */
export function DashletStep({
  onAdd,
  t,
}: Readonly<{ onAdd?: () => void; t: T }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Option
        icon={HiOutlineSquaresPlus}
        title={t("addTitle")}
        body={t("addBody")}
        onSelect={onAdd}
      />
      <Option
        icon={HiOutlineRectangleGroup}
        title={t("templateTitle")}
        body={t("templateBody")}
        badge={t("soon")}
      />
    </div>
  );
}
