"use client";

import {
  HiCheck,
  HiExclamation,
  HiUser,
  HiIdentification,
  HiClock,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { DriverOption } from "./assignment-form";
import { AccreditationBadge, accreditationLabel } from "./accreditation";
import {
  BaseSearchDropdown,
  type FieldConfig,
  type CardRenderProps,
} from "./base-search-dropdown";

// ============================================================================
// Types
// ============================================================================

type DriverMatchType =
  | "name"
  | "rut"
  | "acreditacion"
  | "viajesPrevios"
  | "ultimoViaje";

interface DriverSearchDropdownProps {
  readonly label: string;
  readonly drivers: DriverOption[];
  readonly selectedDriverId: string;
  readonly onSelect: (driverId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
  readonly labelRightElement?: React.ReactNode;
  readonly excludeDriverId?: string;
  /** Server-mode: forward debounced search query to the data source. */
  readonly onQueryChange?: (query: string) => void;
  /** Server-mode: fetch the next page when the list scrolls near the bottom. */
  readonly onReachEnd?: () => void;
  /** Server-mode: show a trailing "loading more" hint during pagination. */
  readonly isLoadingMore?: boolean;
}

// ============================================================================
// Field Configuration
// ============================================================================

const ICON_CLASS = "w-4 h-4 text-gray-600 dark:text-gray-400";

const DRIVER_FIELDS: readonly FieldConfig<DriverOption, DriverMatchType>[] =
  [
    {
      field: "name",
      getValue: (driver) => driver.name,
      getLabel: (dict) =>
        tr("pages.planning.sidebar.assignment.searchFields.name", dict),
      getIcon: () => <HiUser className={ICON_CLASS} />,
    },
    {
      field: "rut",
      getValue: (driver) => driver.rut,
      getLabel: (dict) =>
        tr("pages.planning.sidebar.assignment.searchFields.rut", dict),
      getIcon: () => <HiIdentification className={ICON_CLASS} />,
    },
    {
      field: "acreditacion",
      getValue: (driver, dict) => accreditationLabel(driver.acreditacion, dict),
      getLabel: (dict) =>
        tr("pages.planning.sidebar.assignment.searchFields.status", dict),
      getIcon: () => <HiCheck className={ICON_CLASS} />,
    },
    {
      field: "viajesPrevios",
      getValue: (driver) => String(driver.viajesPrevios),
      getLabel: (dict) =>
        tr("pages.planning.sidebar.assignment.searchFields.trips", dict),
      getIcon: () => <HiClock className={ICON_CLASS} />,
    },
    {
      field: "ultimoViaje",
      getValue: (driver) => driver.ultimoViaje,
      getLabel: (dict) =>
        tr("pages.planning.sidebar.assignment.searchFields.lastTrip", dict),
      getIcon: () => <HiClock className={ICON_CLASS} />,
    },
  ];

// ============================================================================
// Driver Card Component
// ============================================================================

function DriverCard({
  item: driver,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<DriverOption>) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50"
      )}
    >
      {/* Row 1: Name spans the row so long driver names have room. */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isSelected && (
          <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        )}
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {driver.name}
        </span>
      </div>
      {/* Row 2: RUT left, accreditation badge right. */}
      <div className="mt-0.5 mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {driver.rut}
        </span>
        <AccreditationBadge level={driver.acreditacion} dict={dict} />
      </div>

      {/* Stats Column */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {driver.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {driver.ultimoViaje}
          </span>
        </div>
      </div>

      {/* Symptoms - only show if there are any */}
      {(driver.excesoVelocidad > 0 || driver.faltasDescanso > 0) && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          {driver.excesoVelocidad > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              <HiExclamation className="w-3 h-3" />
              {tr("pages.planning.sidebar.assignment.speedExcess", dict)} (
              {driver.excesoVelocidad})
            </span>
          )}
          {driver.faltasDescanso > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              <HiExclamation className="w-3 h-3" />
              {tr("pages.planning.sidebar.assignment.restFaults", dict)} (
              {driver.faltasDescanso})
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedDriverButton(driver: DriverOption, dict: I18nRecord) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {driver.name}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {driver.rut}
        </span>
        <AccreditationBadge level={driver.acreditacion} dict={dict} />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DriverSearchDropdown({
  label,
  drivers,
  selectedDriverId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  labelRightElement,
  excludeDriverId,
  onQueryChange,
  onReachEnd,
  isLoadingMore,
}: DriverSearchDropdownProps) {
  return (
    <BaseSearchDropdown<DriverOption, DriverMatchType>
      label={label}
      items={drivers}
      selectedId={selectedDriverId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      labelRightElement={labelRightElement}
      excludeId={excludeDriverId}
      fields={DRIVER_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchDriver",
        noResults: "pages.planning.sidebar.assignment.noDriversFound",
      }}
      renderCard={(props) => <DriverCard {...props} />}
      renderSelectedButton={renderSelectedDriverButton}
      onQueryChange={onQueryChange}
      onReachEnd={onReachEnd}
      isLoadingMore={isLoadingMore}
    />
  );
}
