"use client";

import {
  HiTruck,
  HiLocationMarker,
  HiStatusOnline,
  HiClock,
  HiScale,
  HiChevronDown,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  BaseSearchDropdown,
  type FieldConfig,
  type CardRenderProps,
} from "./base-search-dropdown";
import {
  VehicleCardButton,
  VehicleHeader,
  GpsStatusColumn,
  StatRow,
  WarningBadge,
  GpsBadge,
  OnlineStatus,
} from "./vehicle-card-shared";

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

export interface TrailerOption {
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

type TrailerMatchType =
  | "plate"
  | "tipo"
  | "estado"
  | "gpsIntegrado"
  | "capacidadKg"
  | "kilometraje";

interface TrailerSearchDropdownProps {
  readonly label: string;
  readonly trailers: TrailerOption[];
  readonly selectedTrailerId: string;
  readonly onSelect: (trailerId: string) => void;
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

const TRAILER_FIELDS: readonly FieldConfig<
  TrailerOption,
  TrailerMatchType
>[] = [
  {
    field: "plate",
    getValue: (trailer) => trailer.plate,
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.trailerSearchFields.plate", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "tipo",
    getValue: (trailer, dict) =>
      tr(
        `pages.planning.sidebar.assignment.trailerType.${trailer.tipo}`,
        dict
      ),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.trailerSearchFields.type", dict),
    getIcon: () => <HiTruck className={ICON_CLASS} />,
  },
  {
    field: "estado",
    getValue: (trailer, dict) =>
      trailer.estado === "disponible"
        ? tr("pages.planning.sidebar.assignment.available", dict)
        : tr("pages.planning.sidebar.assignment.busy", dict),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.trailerSearchFields.status", dict),
    getIcon: () => <HiStatusOnline className={ICON_CLASS} />,
  },
  {
    field: "gpsIntegrado",
    getValue: (trailer, dict) =>
      trailer.gpsIntegrado
        ? tr("pages.planning.sidebar.assignment.integrated", dict)
        : tr("pages.planning.sidebar.assignment.notIntegrated", dict),
    getLabel: (dict) =>
      tr("pages.planning.sidebar.assignment.trailerSearchFields.gps", dict),
    getIcon: () => <HiLocationMarker className={ICON_CLASS} />,
  },
  {
    field: "capacidadKg",
    getValue: (trailer) => String(trailer.capacidadKg),
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.trailerSearchFields.capacity",
        dict
      ),
    getIcon: () => <HiScale className={ICON_CLASS} />,
  },
  {
    field: "kilometraje",
    getValue: (trailer) => String(trailer.kilometraje),
    getLabel: (dict) =>
      tr(
        "pages.planning.sidebar.assignment.trailerSearchFields.mileage",
        dict
      ),
    getIcon: () => <HiClock className={ICON_CLASS} />,
  },
];

// ============================================================================
// Remolque Card Component
// ============================================================================

function TrailerCard({
  item: trailer,
  isSelected,
  isHighlighted,
  dict,
  onClick,
  onMouseEnter,
}: CardRenderProps<TrailerOption>) {
  const isGpsIntegrado = trailer.gpsIntegrado;
  const isOnline = trailer.estadoGps === "online";
  const subtitle = tr(
    `pages.planning.sidebar.assignment.trailerType.${trailer.tipo}`,
    dict
  );

  return (
    <VehicleCardButton
      isHighlighted={isHighlighted}
      isSelected={isSelected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header: Plate + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <VehicleHeader
          plate={trailer.plate}
          subtitle={subtitle}
          isSelected={isSelected}
        />
        <GpsStatusColumn
          isGpsIntegrado={isGpsIntegrado}
          isOnline={isOnline}
          dict={dict}
        />
      </div>

      {/* Stats Column */}
      <div className="flex flex-col gap-0.5 text-[11px]">
        <StatRow
          label={tr("pages.planning.sidebar.assignment.capacity", dict)}
          value={`${trailer.capacidadKg.toLocaleString()} kg`}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          value={trailer.ultimoMantenimiento}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.mileage", dict)}
          value={`${trailer.kilometraje.toLocaleString()} km`}
        />
      </div>

      {/* Reported problems - only show if there are any */}
      <WarningBadge
        count={trailer.problemasReportados}
        labelKey="pages.planning.sidebar.assignment.reportedProblems"
        dict={dict}
      />
    </VehicleCardButton>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedTrailerButton(
  trailer: TrailerOption,
  dict: I18nRecord
) {
  const isGpsIntegrado = trailer.gpsIntegrado;
  const isOnline = trailer.estadoGps === "online";
  const subtitle = tr(
    `pages.planning.sidebar.assignment.trailerType.${trailer.tipo}`,
    dict
  );

  return (
    <div className="flex flex-col">
      {/* Header with plate, type, GPS status, and chevron */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <VehicleHeader plate={trailer.plate} subtitle={subtitle} isSelected />
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <GpsBadge isGpsIntegrado={isGpsIntegrado} dict={dict} />
            <HiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          </div>
          {isGpsIntegrado && <OnlineStatus isOnline={isOnline} dict={dict} />}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-0.5 text-[11px] pt-1 border-t border-gray-100 dark:border-gray-700">
        <StatRow
          label={tr("pages.planning.sidebar.assignment.capacity", dict)}
          value={`${trailer.capacidadKg.toLocaleString()} kg`}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          value={trailer.ultimoMantenimiento}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.mileage", dict)}
          value={`${trailer.kilometraje.toLocaleString()} km`}
        />
      </div>

      {/* Reported problems - only show if there are any */}
      <WarningBadge
        count={trailer.problemasReportados}
        labelKey="pages.planning.sidebar.assignment.reportedProblems"
        dict={dict}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrailerSearchDropdown({
  label,
  trailers,
  selectedTrailerId,
  onSelect,
  placeholder,
  disabled = false,
  dict,
  labelRightElement,
  onQueryChange,
  onReachEnd,
  isLoadingMore,
}: TrailerSearchDropdownProps) {
  return (
    <BaseSearchDropdown<TrailerOption, TrailerMatchType>
      label={label}
      items={trailers}
      selectedId={selectedTrailerId}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      dict={dict}
      labelRightElement={labelRightElement}
      fields={TRAILER_FIELDS}
      translations={{
        search: "pages.planning.sidebar.assignment.searchTrailer",
        noResults: "pages.planning.sidebar.assignment.noTrailersFound",
      }}
      renderCard={(props) => <TrailerCard {...props} />}
      renderSelectedButton={renderSelectedTrailerButton}
      onQueryChange={onQueryChange}
      onReachEnd={onReachEnd}
      isLoadingMore={isLoadingMore}
    />
  );
}
