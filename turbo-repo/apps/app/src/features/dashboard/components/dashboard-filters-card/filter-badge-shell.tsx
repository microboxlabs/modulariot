"use client";

import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
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
  panelRef: React.RefObject<HTMLDivElement | null>;
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
  panelRef,
  children,
}: Readonly<FilterBadgeShellProps>) {
  // Panel renders in a portal (see below) so it can't inherit position from
  // this container — its coordinates are computed from the trigger's rect
  // right when it's about to open, since the badge row sits inside
  // overflow-hidden ancestors (page/layout scroll containers) that would
  // otherwise clip it. Computed here (rather than in an effect that runs
  // after `open` flips) so the first paint already has the right
  // coordinates instead of flashing at (0, 0) for a frame.
  //
  // A badge sitting in the right half of the viewport anchors the panel by its
  // right edge instead, so the panel grows leftwards and stays on screen. The
  // panel's width isn't known before it paints, so this uses the trigger's
  // position rather than measuring — which keeps the pre-paint guarantee above.
  const [position, setPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  }>({ top: 0, left: 0 });

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const alignRight = rect.left > window.innerWidth / 2;
      setPosition({
        top: rect.bottom + 4,
        left: alignRight ? undefined : rect.left,
        right: alignRight ? window.innerWidth - rect.right : undefined,
      });
    }
    onToggle();
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={handleToggle}
        className={`${BADGE_BASE} ${hasValue ? BADGE_ACTIVE : BADGE_IDLE}`}
      >
        <span>{hasValue ? `${filter.label}:` : filter.label}</span>
        {hasValue ? (
          <>
            <span className={`${valueMaxWidth} truncate font-normal`}>
              {displayValue}
            </span>
            <span className="w-3.5" aria-hidden />
          </>
        ) : (
          <HiChevronDown
            className={`h-3 w-3 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {hasValue && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onClear();
            }
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 shrink-0 cursor-pointer rounded-full p-0.5 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800"
        >
          <HiXMark className="h-3 w-3" />
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`fixed z-50 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700 ${panelClassName}`}
            style={{
              top: position.top,
              left: position.left,
              right: position.right,
            }}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
