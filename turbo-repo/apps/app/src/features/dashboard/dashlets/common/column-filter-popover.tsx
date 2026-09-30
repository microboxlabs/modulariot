"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { HiFunnel } from "react-icons/hi2";
import { ColumnFilterInput } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "@/features/dashboard/context/dashboard-context";
import type { DataType } from "./column-types";
import type { ColumnFilter } from "./column-filter-types";

// ============================================================================
// Main popover
// ============================================================================

interface ColumnFilterPopoverProps {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly dataType: DataType;
  readonly currentFilter: ColumnFilter | undefined;
  readonly enumValues: string[];
  readonly onFilterChange: (
    columnKey: string,
    filter: ColumnFilter | null
  ) => void;
}

export function ColumnFilterPopover({
  columnKey,
  columnLabel,
  dataType,
  currentFilter,
  enumValues,
  onFilterChange,
}: ColumnFilterPopoverProps) {
  const { dictionary } = useOptionalDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const hasActiveFilter = !!currentFilter;
  const filterTitle = tr("dashboard.settings.columnFilterTitle", dictionary, {
    column: columnLabel,
  });

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? 220;
      const rawLeft = rect.left;
      const clampedLeft = Math.min(
        rawLeft,
        window.innerWidth - popoverWidth - 8
      );
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, clampedLeft) });
    };

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = popoverRef.current;
    const trigger = buttonRef.current;
    dialog?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => {
      if (
        dialog?.contains(document.activeElement) ||
        document.activeElement === document.body
      ) {
        trigger?.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const cancelDebounceRef = useRef<(() => void) | undefined>(undefined);

  const handleClear = useCallback(() => {
    cancelDebounceRef.current?.();
    onFilterChange(columnKey, null);
    setIsOpen(false);
  }, [columnKey, onFilterChange]);

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`cursor-pointer rounded p-0.5 transition-colors ${
          hasActiveFilter
            ? "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
        title={filterTitle}
      >
        <HiFunnel className="h-3 w-3" />
      </button>

      {isOpen &&
        createPortal(
          <dialog
            ref={popoverRef}
            open
            aria-label={filterTitle}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
            }}
            className="z-9999 min-w-55 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {filterTitle}
            </div>

            <ColumnFilterInput
              columnKey={columnKey}
              dataType={dataType}
              currentFilter={currentFilter}
              enumValues={enumValues}
              onFilterChange={onFilterChange}
              cancelDebounceRef={cancelDebounceRef}
              labels={{
                search: tr("dashboard.settings.columnFilterSearch", dictionary),
                equals: tr("dashboard.settings.columnFilterEquals", dictionary),
                greaterThan: tr(
                  "dashboard.settings.columnFilterGreaterThan",
                  dictionary
                ),
                lessThan: tr(
                  "dashboard.settings.columnFilterLessThan",
                  dictionary
                ),
                between: tr(
                  "dashboard.settings.columnFilterBetween",
                  dictionary
                ),
                min: tr("dashboard.settings.columnFilterMin", dictionary),
                value: tr("dashboard.settings.columnFilterValue", dictionary),
                max: tr("dashboard.settings.columnFilterMax", dictionary),
                from: tr("dashboard.settings.columnFilterFrom", dictionary),
                to: tr("dashboard.settings.columnFilterTo", dictionary),
                empty: tr("dashboard.settings.columnFilterEmpty", dictionary),
                noMatches: tr(
                  "dashboard.settings.columnFilterNoMatches",
                  dictionary
                ),
                noValues: tr(
                  "dashboard.settings.columnFilterNoValues",
                  dictionary
                ),
                all: tr("dashboard.settings.columnFilterAll", dictionary),
                yes: tr("dashboard.settings.columnFilterYes", dictionary),
                no: tr("dashboard.settings.columnFilterNo", dictionary),
                operator: tr(
                  "dashboard.settings.columnFilterOperator",
                  dictionary
                ),
              }}
            />

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleClear}
                className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                {tr("dashboard.settings.columnFilterClear", dictionary)}
              </button>
            )}
          </dialog>,
          document.body
        )}
    </>
  );
}

// ============================================================================
// Filter input dispatcher
// ============================================================================
