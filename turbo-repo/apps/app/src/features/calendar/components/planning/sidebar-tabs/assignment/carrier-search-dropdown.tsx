"use client";

import {
  HiCheck,
  HiOfficeBuilding,
  HiIdentification,
  HiStatusOnline,
  HiChevronDown,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  BaseSearchDropdown,
  type FieldConfig,
  type CardRenderProps,
} from "./base-search-dropdown";

// ============================================================================
// Types
// ============================================================================

export interface CarrierOption {
  id: string;
  name: string;
  rut: string;
  /**
   * Upstream `prve_codigo` from `ams.fn_rd_accredited_resources.external_id`.
   * Carried alongside `id` (the resource UUID) so downstream payloads (Alerce
   * `proveedor` via the calendar binding) can use the upstream code without a
   * second lookup. `null` when the upstream row has no code on file.
   */
  externalId: string | null;
  estado: "habilitado" | "no habilitado";
}

type CarrierMatchType = "name" | "rut" | "estado";

interface CarrierSearchDropdownProps {
  readonly label: string;
  readonly carriers: CarrierOption[];
  readonly selectedCarrierId: string;
  readonly onSelect: (carrierId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
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

const CARRIER_FIELDS: readonly FieldConfig<
  CarrierOption,
  CarrierMatchType
>[] = [
  {
    field: "name",
    getValue: (carrier) => carrier.name,
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.carrierSearchFields.name",
        dict
      ),
    getIcon: () => <HiOfficeBuilding className={ICON_CLASS} />,
  },
  {
    field: "rut",
    getValue: (carrier) => carrier.rut,
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.carrierSearchFields.rut",
        dict
      ),
    getIcon: () => <HiIdentification className={ICON_CLASS} />,
  },
  {
    field: "estado",
    getValue: (carrier, dict) =>
      carrier.estado === "habilitado"
        ? tr("pages.planning.sidebar.assignment.enabled", dict)
        : tr("pages.planning.sidebar.assignment.notEnabled", dict),
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.carrierSearchFields.status",
        dict
      ),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
];

// ============================================================================
// Transportista Card Component
// ============================================================================

function CarrierCard({
  item: carrier,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<CarrierOption>) {
  const isEnabled = carrier.estado === "habilitado";

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
      {/* Row 1: Name spans the full width so long carrier names get room. */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isSelected && (
          <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        )}
        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {carrier.name}
        </span>
      </div>
      {/* Row 2: RUT on the left, accreditation badge on the right. */}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {carrier.rut}
        </span>
        {isEnabled ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
              <HiCheck className="w-2.5 h-2.5" />
            </span>
            {tr("pages.planning.sidebar.assignment.enabled", dict)}
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {tr("pages.planning.sidebar.assignment.notEnabled", dict)}
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedCarrierButton(
  carrier: CarrierOption,
  dict: I18nRecord
) {
  const isEnabled = carrier.estado === "habilitado";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + chevron on the right so the name spans the row. */}
        <div className="flex items-center gap-1.5 min-w-0">
          <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {carrier.name}
          </span>
        </div>
        {/* Row 2: RUT on the left, badge on the right. */}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {carrier.rut}
          </span>
          {isEnabled ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
              <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                <HiCheck className="w-2.5 h-2.5" />
              </span>
              {tr("pages.planning.sidebar.assignment.enabled", dict)}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              {tr("pages.planning.sidebar.assignment.notEnabled", dict)}
            </span>
          )}
        </div>
      </div>
      <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CarrierSearchDropdown({
  label,
  carriers,
  selectedCarrierId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  onQueryChange,
  onReachEnd,
  isLoadingMore,
}: CarrierSearchDropdownProps) {
  return (
    <BaseSearchDropdown<CarrierOption, CarrierMatchType>
      label={label}
      items={carriers}
      selectedId={selectedCarrierId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      fields={CARRIER_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchCarrier",
        noResults: "pages.planning.sidebar.assignment.noCarriersFound",
      }}
      renderCard={(props) => <CarrierCard {...props} />}
      renderSelectedButton={renderSelectedCarrierButton}
      onQueryChange={onQueryChange}
      onReachEnd={onReachEnd}
      isLoadingMore={isLoadingMore}
    />
  );
}
