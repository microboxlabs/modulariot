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
  const subtitle = tr(
    `pages.planning.sidebar.assignment.remolqueType.${remolque.tipo}`,
    dict
  );

  return (
    <VehicleCardButton
      isHighlighted={isHighlighted}
      isSelected={isSelected}
      isAvailable={isAvailable}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header: Plate + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <VehicleHeader
          plate={remolque.plate}
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
          value={`${remolque.capacidadKg.toLocaleString()} kg`}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          value={remolque.ultimoMantenimiento}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.mileage", dict)}
          value={`${remolque.kilometraje.toLocaleString()} km`}
        />
      </div>

      {/* Reported problems - only show if there are any */}
      <WarningBadge
        count={remolque.problemasReportados}
        labelKey="pages.planning.sidebar.assignment.reportedProblems"
        dict={dict}
      />
    </VehicleCardButton>
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
  const subtitle = tr(
    `pages.planning.sidebar.assignment.remolqueType.${remolque.tipo}`,
    dict
  );

  return (
    <div className="flex flex-col">
      {/* Header with plate, type, GPS status, and chevron */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <VehicleHeader plate={remolque.plate} subtitle={subtitle} isSelected />
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
          value={`${remolque.capacidadKg.toLocaleString()} kg`}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastMaintenance", dict)}
          value={remolque.ultimoMantenimiento}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.mileage", dict)}
          value={`${remolque.kilometraje.toLocaleString()} km`}
        />
      </div>

      {/* Reported problems - only show if there are any */}
      <WarningBadge
        count={remolque.problemasReportados}
        labelKey="pages.planning.sidebar.assignment.reportedProblems"
        dict={dict}
      />
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
