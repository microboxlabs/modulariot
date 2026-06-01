"use client";

import { useEffect, useRef, useState, type ReactNode, useCallback } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiCheck, HiChevronDown } from "react-icons/hi";
import { useCalendarHost } from "../../context/calendar-provider";
import { TimeSlotAssignment, type TimeSlotOption } from "./time-slot-assignment";

/** The two tabs the planning sidebar form switches between. */
export type SidebarFormTab = "planificacion" | "assignment";

export interface SidebarFormCategoryOption {
  value: string;
  label: string;
}

/** Generic service-category dropdown (opens upward, host-translated labels). */
function CategorySelect({
  options,
  selected,
  onChange,
  isLoading,
}: Readonly<{
  options: SidebarFormCategoryOption[];
  selected: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}>) {
  const host = useCalendarHost();
  const t = useCallback(
    (path: string) => host.i18n.tr(path, host.i18n.dict),
    [host]
  );

  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
        {t("pages.planning.sidebar.form.serviceCategory")}
      </label>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="font-medium text-gray-900 dark:text-white">
          {isLoading
            ? t("pages.planning.sidebar.form.serviceCategoryLoading")
            : (options.find((o) => o.value === selected)?.label ??
              t("pages.planning.sidebar.form.serviceCategoryPlaceholder"))}
        </span>
        <HiChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                option.value === selected
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              } cursor-pointer`}
            >
              <div className="flex items-center gap-2">
                {option.value === selected && (
                  <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                )}
                <span
                  className={`text-sm ${option.value === selected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}
                >
                  {option.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface SidebarFormShellProps {
  /** Host-rendered tab switcher (kept app-side; e.g. the app's TabButtons). */
  tabs: ReactNode;
  activeTab: SidebarFormTab;
  canPlan: boolean;
  canAssign: boolean;
  isReadOnlyView: boolean;
  /** Host-provided assignment panel (domain) shown on the assignment tab. */
  assignPanel?: ReactNode;
  // ── planificacion tab body ──
  serviceCategoryOptions: SidebarFormCategoryOption[];
  selectedServiceCategory: string;
  onServiceCategoryChange: (value: string) => void;
  isLoadingServiceTypes: boolean;
  timeOptions: TimeSlotOption[];
  selectedTime: string;
  onTimeChange: (time: string) => void;
  isSlotsLoading: boolean;
  canConfirm: boolean;
  /** Reassignment in progress — swaps the confirm button label. */
  isReassigning: boolean;
  isSubmitting: boolean;
}

/**
 * Generic, domain-agnostic tab region of the planning sidebar form: the
 * service-category select + time/andén picker + confirm button on the
 * "planificación" tab, and a host-injected {@link SidebarFormShellProps.assignPanel}
 * on the "asignación" tab. The tab switcher and the assignment panel stay
 * host-side (domain); all generic chrome here reads labels via the host i18n
 * seam. Render this inside the host's `<form>` so the confirm button submits it.
 */
export function SidebarFormShell({
  tabs,
  activeTab,
  canPlan,
  canAssign,
  isReadOnlyView,
  assignPanel,
  serviceCategoryOptions,
  selectedServiceCategory,
  onServiceCategoryChange,
  isLoadingServiceTypes,
  timeOptions,
  selectedTime,
  onTimeChange,
  isSlotsLoading,
  canConfirm,
  isReassigning,
  isSubmitting,
}: Readonly<SidebarFormShellProps>) {
  const host = useCalendarHost();
  const t = (path: string) => host.i18n.tr(path, host.i18n.dict);

  return (
    <div className="flex flex-col gap-2">
      {tabs}

      {/* Tab Content — wrapped in its own disabled fieldset so the individual
          inputs/selects are non-mutating in read-only mode, without freezing
          the tab switcher above. */}
      <fieldset
        disabled={isReadOnlyView}
        className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0"
      >
        {activeTab === "planificacion" && (canPlan || isReadOnlyView) && (
          <>
            {/* Service Category — always visible */}
            <CategorySelect
              options={serviceCategoryOptions}
              selected={selectedServiceCategory}
              onChange={onServiceCategoryChange}
              isLoading={isLoadingServiceTypes}
            />
            {/* Time/Andén picker — only when slot is selected */}
            {!isSlotsLoading && timeOptions.length > 0 && (
              <TimeSlotAssignment
                timeOptions={timeOptions}
                selectedTime={selectedTime}
                onTimeChange={onTimeChange}
              />
            )}
            {!isReadOnlyView && (
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  color="blue"
                  className="flex-1"
                  disabled={!canConfirm || isSubmitting}
                >
                  {isSubmitting && <Spinner size="sm" className="mr-2" />}
                  {isReassigning
                    ? t("pages.planning.sidebar.form.confirmReassignment")
                    : t("pages.planning.sidebar.form.confirm")}
                </Button>
              </div>
            )}
          </>
        )}
        {activeTab === "assignment" && (canAssign || isReadOnlyView) && assignPanel}
      </fieldset>
    </div>
  );
}
