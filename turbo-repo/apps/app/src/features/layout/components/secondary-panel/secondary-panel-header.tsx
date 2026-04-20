"use client";

import type { ComponentProps, FC } from "react";
import { twMerge } from "tailwind-merge";

interface SecondaryPanelHeaderProps {
  icon?: FC<ComponentProps<"svg">>;
  label: string;
}

export default function SecondaryPanelHeader({
  icon: Icon,
  label,
}: Readonly<SecondaryPanelHeaderProps>) {
  return (
    <div
      className={twMerge(
        "flex items-center gap-2 border-b border-gray-200 px-4 py-3",
        "dark:border-gray-700"
      )}
    >
      {Icon && (
        <Icon className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      )}
      <span className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
    </div>
  );
}
