"use client";

import { HiPlus, HiSearch } from "react-icons/hi";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import type { SidebarCreateAction } from "../../types/common.types";

interface SecondaryPanelSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  createAction?: SidebarCreateAction;
}

export default function SecondaryPanelSearch({
  value,
  onChange,
  placeholder,
  createAction,
}: Readonly<SecondaryPanelSearchProps>) {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="relative flex-1">
        <HiSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={twMerge(
            "w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm",
            "text-gray-900 placeholder:text-gray-400",
            "focus:border-primary-500 focus:ring-1 focus:ring-primary-500",
            "dark:border-gray-600 dark:bg-gray-700 dark:text-white",
            "dark:placeholder:text-gray-400 dark:focus:border-primary-500"
          )}
        />
      </div>
      {createAction && (
        <Link
          href={createAction.href}
          aria-label={createAction.label}
          className={twMerge(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            "bg-blue-600 text-white hover:bg-blue-700",
            "dark:bg-blue-500 dark:hover:bg-blue-600"
          )}
        >
          <HiPlus className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
