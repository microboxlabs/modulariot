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

export interface TransportistaOption {
  id: string;
  name: string;
  rut: string;
  estado: "habilitado" | "no habilitado";
}

type TransportistaMatchType = "name" | "rut" | "estado";

interface TransportistaSearchDropdownProps {
  readonly label: string;
  readonly transportistas: TransportistaOption[];
  readonly selectedTransportistaId: string;
  readonly onSelect: (transportistaId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
}

// ============================================================================
// Field Configuration
// ============================================================================

const ICON_CLASS = "w-4 h-4 text-gray-600 dark:text-gray-400";

const createTransportistaFields = (): readonly FieldConfig<
  TransportistaOption,
  TransportistaMatchType
>[] => [
  {
    field: "name",
    getValue: (transportista) => transportista.name,
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.transportistaSearchFields.name",
        dict
      ),
    getIcon: () => <HiOfficeBuilding className={ICON_CLASS} />,
  },
  {
    field: "rut",
    getValue: (transportista) => transportista.rut,
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.transportistaSearchFields.rut",
        dict
      ),
    getIcon: () => <HiIdentification className={ICON_CLASS} />,
  },
  {
    field: "estado",
    getValue: (transportista) => transportista.estado,
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.transportistaSearchFields.status",
        dict
      ),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
];

const TRANSPORTISTA_FIELDS = createTransportistaFields();

// ============================================================================
// Transportista Card Component
// ============================================================================

function TransportistaCard({
  item: transportista,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<TransportistaOption>) {
  const isEnabled = transportista.estado === "habilitado";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50",
        !isEnabled && "opacity-60"
      )}
    >
      {/* Header: Name + RUT + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {transportista.name}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {transportista.rut}
          </span>
        </div>
        {isEnabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
              <HiCheck className="w-2.5 h-2.5" />
            </span>
            {tr("pages.planning.sidebar.assignment.enabled", dict)}
          </span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedTransportistaButton(
  transportista: TransportistaOption,
  dict: I18nRecord
) {
  const isEnabled = transportista.estado === "habilitado";

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {transportista.name}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {transportista.rut}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isEnabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
              <HiCheck className="w-2.5 h-2.5" />
            </span>
            {tr("pages.planning.sidebar.assignment.enabled", dict)}
          </span>
        )}
        <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TransportistaSearchDropdown({
  label,
  transportistas,
  selectedTransportistaId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
}: TransportistaSearchDropdownProps) {
  return (
    <BaseSearchDropdown<TransportistaOption, TransportistaMatchType>
      label={label}
      items={transportistas}
      selectedId={selectedTransportistaId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      fields={TRANSPORTISTA_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchTransportista",
        noResults: "pages.planning.sidebar.assignment.noTransportistasFound",
      }}
      renderCard={(props) => <TransportistaCard {...props} />}
      renderSelectedButton={renderSelectedTransportistaButton}
      canSelect={(transportista) => transportista.estado === "habilitado"}
    />
  );
}
