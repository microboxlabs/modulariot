"use client";

import type React from "react";
import { HiChevronDown, HiXMark } from "react-icons/hi2";
import type { DashboardFilterParam } from "../../types/dashboard.types";
import { BADGE_ACTIVE, BADGE_IDLE, BADGE_BASE } from "./badge-styles";

interface FilterBadgeShellProps {
  filter: DashboardFilterParam;
  hasValue: boolean;
  displayValue: string | null;
  valueMaxWidth?: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  panelClassName: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function FilterBadgeShell({
  filter,
  hasValue,
  displayValue,
  valueMaxWidth = "max-w-32",
  open,
  onToggle,
  onClear,
  panelClassName,
  containerRef,
  children,
}: Readonly<FilterBadgeShellProps>) {
  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        className={`${BADGE_BASE} ${hasValue ? BADGE_ACTIVE : BADGE_IDLE}`}
      >
        <span>{hasValue ? `${filter.label}:` : filter.label}</span>
        {hasValue ? (
          <>
            <span className={`${valueMaxWidth} truncate font-normal`}>{displayValue}</span>
            <span className="w-3.5" aria-hidden />
          </>
        ) : (
          <HiChevronDown className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {hasValue && (
        <button
          type="button"
          onMouseDown={(e) => { e.stopPropagation(); onClear(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onClear(); }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 shrink-0 cursor-pointer rounded-full p-0.5 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          <HiXMark className="h-3 w-3" />
        </button>
      )}
      {open && (
        <div className={`absolute left-0 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700 ${panelClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
