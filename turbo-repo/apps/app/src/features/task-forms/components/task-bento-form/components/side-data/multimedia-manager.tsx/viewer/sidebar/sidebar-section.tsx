"use client";

import { useState, type ReactNode } from "react";
import { HiChevronDown } from "react-icons/hi2";

export function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: Readonly<{
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}>) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {title}
        </span>
        <HiChevronDown
          className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3 pt-2">{children}</div>
      </div>
    </div>
  );
}
