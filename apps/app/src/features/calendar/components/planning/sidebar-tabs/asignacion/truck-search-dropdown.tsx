"use client";

import {
  HiCheck,
  HiExclamation,
  HiTruck,
  HiLocationMarker,
  HiStatusOnline,
  HiClock,
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

export interface CamionOption {
  id: string;
  plate: string;
  marca: string;
  tipo: "camion" | "furgon" | "camioneta";
  estado: "disponible" | "ocupado";
  gpsIntegrado: boolean;
  estadoGps: "online" | "offline";
  viajesPrevios: number;
  ultimoViaje: string;
  perdidasSenal: number;
  latitude: number | null;
  longitude: number | null;
  heading: number;
}

type TruckMatchType =
  | "plate"
  | "marca"
  | "tipo"
  | "estado"
  | "gpsIntegrado"
  | "viajesPrevios";

interface TruckSearchDropdownProps {
  readonly label: string;
  readonly trucks: CamionOption[];
  readonly selectedTruckId: string;
  readonly onSelect: (truckId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
  readonly labelRightElement?: React.ReactNode;
}

// ============================================================================
// Field Configuration
// ============================================================================

const ICON_CLASS = "w-4 h-4 text-gray-600 dark:text-gray-400";

const createTruckFields = (): readonly FieldConfig<
  CamionOption,
  TruckMatchType
>[] => [
  {
    field: "plate",
    getValue: (truck) => truck.plate,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.plate", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "marca",
    getValue: (truck) => truck.marca,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.brand", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "tipo",
    getValue: (truck) => truck.tipo,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.type", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "estado",
    getValue: (truck) => truck.estado,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.status", dict),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
  {
    field: "gpsIntegrado",
    getValue: (truck) =>
      truck.gpsIntegrado ? "gps integrado" : "no integrado",
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.gps", dict),
    getIcon: () => <HiLocationMarker className={ICON_CLASS} />,
  },
  {
    field: "viajesPrevios",
    getValue: (truck) => String(truck.viajesPrevios),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.trips", dict),
    getIcon: () => <HiClock className={ICON_CLASS} />,
  },
];

const TRUCK_FIELDS = createTruckFields();

// ============================================================================
// Truck Card Component
// ============================================================================

function TruckCard({
  item: truck,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<CamionOption>) {
  const isAvailable = truck.estado === "disponible";
  const isGpsIntegrado = truck.gpsIntegrado;
  const isOnline = truck.estadoGps === "online";

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
      {/* Header: Plate + Brand + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isSelected && (
              <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {truck.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {truck.marca} ·{" "}
            {tr(
              `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
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
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.ultimoViaje}
          </span>
        </div>
      </div>

      {/* Signal losses - only show if there are any */}
      {truck.perdidasSenal > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.signalLosses", dict)} (
            {truck.perdidasSenal})
          </span>
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedTruckButton(truck: CamionOption, dict: I18nRecord) {
  const isGpsIntegrado = truck.gpsIntegrado;
  const isOnline = truck.estadoGps === "online";

  return (
    <div className="flex flex-col">
      {/* Header with plate, brand, type, GPS status, and chevron */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <HiCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {truck.plate}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {truck.marca} ·{" "}
            {tr(
              `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
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
            {tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.viajesPrevios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {truck.ultimoViaje}
          </span>
        </div>
      </div>

      {/* Signal losses - only show if there are any */}
      {truck.perdidasSenal > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-gray-100 dark:border-gray-700">
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <HiExclamation className="w-3 h-3" />
            {tr("pages.planning.sidebar.assignment.signalLosses", dict)} (
            {truck.perdidasSenal})
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TruckSearchDropdown({
  label,
  trucks,
  selectedTruckId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  labelRightElement,
}: TruckSearchDropdownProps) {
  return (
    <BaseSearchDropdown<CamionOption, TruckMatchType>
      label={label}
      items={trucks}
      selectedId={selectedTruckId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      labelRightElement={labelRightElement}
      fields={TRUCK_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchTruck",
        noResults: "pages.planning.sidebar.assignment.noTrucksFound",
      }}
      renderCard={(props) => <TruckCard {...props} />}
      renderSelectedButton={renderSelectedTruckButton}
      canSelect={(truck) => truck.estado === "disponible"}
    />
  );
}
