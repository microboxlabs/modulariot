"use client";

import type { ReactNode } from "react";
import {
  HiTruck,
  HiLocationMarker,
  HiStatusOnline,
  HiClock,
  HiChevronDown,
  HiCheck,
  HiExclamation,
} from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  AccreditationBadge,
  accreditationLabel,
  type AccreditationLevel,
} from "./accreditation";
import {
  BaseSearchDropdown,
  type FieldConfig,
  type CardRenderProps,
} from "./base-search-dropdown";
import {
  VehicleCardButton,
  VehicleHeader,
  StatRow,
} from "./vehicle-card-shared";

// ============================================================================
// Types
// ============================================================================

export interface TruckOption {
  id: string;
  plate: string;
  /**
   * Upstream `cami_matricula` from `ams.fn_rd_accredited_resources.external_id`.
   * Equal to `plate` for trucks today; carried for symmetry with the other
   * Option types and to keep the downstream payload uniform.
   */
  externalId: string | null;
  marca: string;
  tipo: "truck" | "furgon" | "trucketa";
  acreditacion: AccreditationLevel;
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
  | "acreditacion"
  | "gpsIntegrado"
  | "viajesPrevios";

interface TruckSearchDropdownProps {
  readonly label: string;
  readonly trucks: TruckOption[];
  readonly selectedTruckId: string;
  readonly onSelect: (truckId: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly dict: I18nRecord;
  readonly labelRightElement?: React.ReactNode;
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

const TRUCK_FIELDS: readonly FieldConfig<TruckOption, TruckMatchType>[] = [
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
    getValue: (truck, dict) =>
      tr(`pages.planning.sidebar.assignment.truckType.${truck.tipo}`, dict),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.type", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "acreditacion",
    getValue: (truck, dict) => accreditationLabel(truck.acreditacion, dict),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.truckSearchFields.status", dict),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
  {
    field: "gpsIntegrado",
    getValue: (truck, dict) =>
      truck.gpsIntegrado
        ? tr("pages.planning.sidebar.assignment.integrated", dict)
        : tr("pages.planning.sidebar.assignment.notIntegrated", dict),
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

// ============================================================================
// Truck Card Component
// ============================================================================

/**
 * Renders a label/value row where the value is a colored chip (icon + text).
 * Used for GPS Integrado, Estado GPS and Pérdidas de señal so the list layout
 * stays a single scannable column per the planning mockup.
 */
interface RichStatRowProps {
  readonly label: string;
  readonly value: ReactNode;
}

function RichStatRow({ label, value }: RichStatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function GpsIntegrationValue({
  isGpsIntegrado,
  dict,
}: {
  readonly isGpsIntegrado: boolean;
  readonly dict: I18nRecord;
}) {
  const tone = isGpsIntegrado
    ? "text-green-600 dark:text-green-400"
    : "text-gray-500 dark:text-gray-400";
  const Icon = isGpsIntegrado ? HiCheck : HiExclamation;
  return (
    <span className={twMerge("inline-flex items-center gap-1", tone)}>
      <Icon className="w-3.5 h-3.5" />
      {tr(
        isGpsIntegrado
          ? "pages.planning.sidebar.assignment.integrated"
          : "pages.planning.sidebar.assignment.notIntegrated",
        dict
      )}
    </span>
  );
}

function GpsStateValue({
  isGpsIntegrado,
  isOnline,
  dict,
}: {
  readonly isGpsIntegrado: boolean;
  readonly isOnline: boolean;
  readonly dict: I18nRecord;
}) {
  // Can't be online if the device isn't integrated in the first place — in
  // that case the row collapses to a neutral dash so the user doesn't see a
  // contradictory "Offline" next to "No Integrado".
  if (!isGpsIntegrado) {
    return <span className="text-gray-500 dark:text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
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
        {tr(
          isOnline
            ? "pages.planning.sidebar.assignment.online"
            : "pages.planning.sidebar.assignment.offline",
          dict
        )}
      </span>
    </span>
  );
}

function SignalLossValue({
  count,
  dict,
}: {
  readonly count: number;
  readonly dict: I18nRecord;
}) {
  if (count <= 0) {
    return <span className="text-gray-900 dark:text-white">0</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
      <HiExclamation className="w-3.5 h-3.5" />
      {tr("pages.planning.sidebar.assignment.losses", dict, {
        count: String(count),
      })}
    </span>
  );
}

/**
 * Shared 5-row stats block rendered both inside the dropdown list card and
 * the currently-selected button, per the planning mockup. Keeping it as a
 * single component keeps the two views in lock-step — adding or reordering
 * a row happens in one place.
 */
interface TruckStatsRowsProps {
  readonly truck: TruckOption;
  readonly dict: I18nRecord;
}

function TruckStatsRows({ truck, dict }: TruckStatsRowsProps) {
  const isGpsIntegrado = truck.gpsIntegrado;
  const isOnline = truck.estadoGps === "online";
  return (
    <>
      <RichStatRow
        label={tr("pages.planning.sidebar.assignment.gpsIntegrated", dict)}
        value={
          <GpsIntegrationValue isGpsIntegrado={isGpsIntegrado} dict={dict} />
        }
      />
      <RichStatRow
        label={tr("pages.planning.sidebar.assignment.gpsStatus", dict)}
        value={
          <GpsStateValue
            isGpsIntegrado={isGpsIntegrado}
            isOnline={isOnline}
            dict={dict}
          />
        }
      />
      <StatRow
        label={tr("pages.planning.sidebar.assignment.previousTrips", dict)}
        value={truck.viajesPrevios}
      />
      <StatRow
        label={tr("pages.planning.sidebar.assignment.lastTrip", dict)}
        value={truck.ultimoViaje}
      />
      <RichStatRow
        label={tr("pages.planning.sidebar.assignment.signalLosses", dict)}
        value={<SignalLossValue count={truck.perdidasSenal} dict={dict} />}
      />
    </>
  );
}

function TruckCard({
  item: truck,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<TruckOption>) {
  const truckTypeLabel = tr(
    `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
    dict
  );
  const subtitle = `${truck.marca || "—"} · ${truckTypeLabel}`;

  return (
    <VehicleCardButton
      isHighlighted={isHighlighted}
      isSelected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header: plate + subtitle (marca · tipo). */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <VehicleHeader
          plate={truck.plate}
          subtitle={subtitle}
          isSelected={isSelected}
        />
        <AccreditationBadge level={truck.acreditacion} dict={dict} />
      </div>

      {/* 5-row stats block, always visible (mockup). */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <TruckStatsRows truck={truck} dict={dict} />
      </div>
    </VehicleCardButton>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedTruckButton(truck: TruckOption, dict: I18nRecord) {
  const truckTypeLabel = tr(
    `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
    dict
  );
  const subtitle = `${truck.marca || "—"} · ${truckTypeLabel}`;

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <VehicleHeader plate={truck.plate} subtitle={subtitle} isSelected />
        <div className="flex items-center gap-1.5 shrink-0">
          <AccreditationBadge level={truck.acreditacion} dict={dict} />
          <HiChevronDown className="w-4 h-4 text-gray-500" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 text-[11px] pt-1 border-t border-gray-100 dark:border-gray-700">
        <TruckStatsRows truck={truck} dict={dict} />
      </div>
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
  onQueryChange,
  onReachEnd,
  isLoadingMore,
}: TruckSearchDropdownProps) {
  return (
    <BaseSearchDropdown<TruckOption, TruckMatchType>
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
      onQueryChange={onQueryChange}
      onReachEnd={onReachEnd}
      isLoadingMore={isLoadingMore}
    />
  );
}
