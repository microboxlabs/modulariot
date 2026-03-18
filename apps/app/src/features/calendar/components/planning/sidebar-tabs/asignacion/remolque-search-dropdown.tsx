"use client";

import {
  HiCheck,
  HiExclamation,
  HiTruck,
  HiLocationMarker,
  HiStatusOnline,
  HiClock,
  HiScale,
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

export type RemolqueTipo =
  | "ARFJ"
  | "BAT"
  | "C100"
  | "CB20"
  | "CB40"
  | "CB60"
  | "CB70"
  | "CB80"
  | "CBJ"
  | "CBJE"
  | "CFX"
  | "EST"
  | "FURG"
  | "PNE6"
  | "R10T"
  | "R15T"
  | "R28T"
  | "RBAJ"
  | "RDRO"
  | "REM"
  | "REXT"
  | "RGEN"
  | "RMOD"
  | "RPAL"
  | "RPNE"
  | "S32"
  | "SI20"
  | "SI40"
  | "SIDE"
  | "SIL";

export interface RemolqueOption {
  id: string;
  plate: string;
  tipo: RemolqueTipo;
  estado: "disponible" | "ocupado";
  gpsIntegrado: boolean;
  estadoGps: "online" | "offline";
  capacidadKg: number;
  ultimoMantenimiento: string;
  kilometraje: number;
  problemasReportados: number;
}

type RemolqueMatchType =
  | "plate"
  | "tipo"
  | "estado"
  | "gpsIntegrado"
  | "capacidadKg"
  | "kilometraje";

interface RemolqueSearchDropdownProps {
  readonly label: string;
  readonly remolques: RemolqueOption[];
  readonly selectedRemolqueId: string;
  readonly onSelect: (remolqueId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
}

// ============================================================================
// Field Configuration
// ============================================================================

const ICON_CLASS = "w-4 h-4 text-gray-600 dark:text-gray-400";

const createRemolqueFields = (): readonly FieldConfig<
  RemolqueOption,
  RemolqueMatchType
>[] => [
  {
    field: "plate",
    getValue: (remolque) => remolque.plate,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.remolqueSearchFields.plate", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "tipo",
    getValue: (remolque) => remolque.tipo,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.remolqueSearchFields.type", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "estado",
    getValue: (remolque) => remolque.estado,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.remolqueSearchFields.status", dict),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
  {
    field: "gpsIntegrado",
    getValue: (remolque) =>
      remolque.gpsIntegrado ? "gps integrado" : "no integrado",
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.remolqueSearchFields.gps", dict),
    getIcon: () => <HiLocationMarker className={ICON_CLASS} />,
  },
  {
    field: "capacidadKg",
    getValue: (remolque) => String(remolque.capacidadKg),
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.remolqueSearchFields.capacity",
        dict
      ),
    getIcon: () => <HiScale className={ICON_CLASS} />,
  },
  {
    field: "kilometraje",
    getValue: (remolque) => String(remolque.kilometraje),
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.remolqueSearchFields.mileage",
        dict
      ),
    getIcon: () => <HiClock className={ICON_CLASS} />,
  },
];

const REMOLQUE_FIELDS = createRemolqueFields();

// ============================================================================
// Remolque Card Component
// ============================================================================

function RemolqueCard({
  item: remolque,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<RemolqueOption>) {
  const isAvailable = remolque.estado === "disponible";
  const isGpsIntegrado = remolque.gpsIntegrado;
  const isOnline = remolque.estadoGps === "online";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={twMerge(
        "w-full text-left p-3 transition-colors",
        isHighlighted && "bg-blue-50 dark:bg-blue-900/30",
        isSelected && !isHighlighted && "bg-gray-50 dark:bg-gray-700/50",
        !isAvailable && "opacity-60"
      )}
    >
      {/* Header: Plate + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {remolque.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr(
              `pages.planning.sidebar.assignment.remolqueType.${remolque.tipo}`,
              dict
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isGpsIntegrado && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                <HiCheck className="w-2.5 h-2.5" />
              </span>
              {tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
            </span>
          )}
          {isGpsIntegrado && (
            <span className="flex items-center gap-1 text-[10px]">
              <span
                className={twMerge(
                  "w-2 h-2 rounded-full",
                  isOnline ? "bg-green-500" : "bg-gray-400"
                )}
              />
              <span
                className={twMerge(
                  "font-medium",
                  isOnline
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {isOnline
                  ? tr("pages.planning.sidebar.assignment.online", dict)
                  : tr("pages.planning.sidebar.assignment.offline", dict)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Stats Column */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.capacity", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.capacidadKg.toLocaleString()} kg
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.ultimoMantenimiento}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.mileage", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.kilometraje.toLocaleString()} km
          </span>
        </div>
      </div>

      {/* Reported problems - only show if there are any */}
      {remolque.problemasReportados > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.reportedProblems", dict)} (
            {remolque.problemasReportados})
          </span>
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedRemolqueButton(
  remolque: RemolqueOption,
  dict: I18nRecord
) {
  const isGpsIntegrado = remolque.gpsIntegrado;
  const isOnline = remolque.estadoGps === "online";

  return (
    <div className="flex flex-col">
      {/* Header with plate, type, GPS status, and chevron */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {remolque.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr(
              `pages.planning.sidebar.assignment.remolqueType.${remolque.tipo}`,
              dict
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            {isGpsIntegrado && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-green-200 dark:bg-green-800/50">
                  <HiCheck className="w-2.5 h-2.5" />
                </span>
                {tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
              </span>
            )}
            <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          </div>
          {isGpsIntegrado && (
            <span className="flex items-center gap-1 text-[10px]">
              <span
                className={twMerge(
                  "w-2 h-2 rounded-full",
                  isOnline ? "bg-green-500" : "bg-gray-400"
                )}
              />
              <span
                className={twMerge(
                  "font-medium",
                  isOnline
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {isOnline
                  ? tr("pages.planning.sidebar.assignment.online", dict)
                  : tr("pages.planning.sidebar.assignment.offline", dict)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-0.5 text-[11px] pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.capacity", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.capacidadKg.toLocaleString()} kg
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.ultimoMantenimiento}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.mileage", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {remolque.kilometraje.toLocaleString()} km
          </span>
        </div>
      </div>

      {/* Reported problems - only show if there are any */}
      {remolque.problemasReportados > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.reportedProblems", dict)} (
            {remolque.problemasReportados})
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RemolqueSearchDropdown({
  label,
  remolques,
  selectedRemolqueId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
}: RemolqueSearchDropdownProps) {
  return (
    <BaseSearchDropdown<RemolqueOption, RemolqueMatchType>
      label={label}
      items={remolques}
      selectedId={selectedRemolqueId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      fields={REMOLQUE_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchRemolque",
        noResults: "pages.planning.sidebar.assignment.noRemolquesFound",
      }}
      renderCard={(props) => <RemolqueCard {...props} />}
      renderSelectedButton={renderSelectedRemolqueButton}
      canSelect={(remolque) => remolque.estado === "disponible"}
    />
  );
}
