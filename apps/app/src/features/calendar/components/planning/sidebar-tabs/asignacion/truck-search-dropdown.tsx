"use client";

import {
  HiTruck,
  HiLocationMarker,
  HiStatusOnline,
  HiClock,
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

const TRUCK_FIELDS: readonly FieldConfig<CamionOption, TruckMatchType>[] = [
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
    field: "estado",
    getValue: (truck, dict) =>
      truck.estado === "disponible"
        ? tr("pages.planning.sidebar.assignment.available", dict)
        : tr("pages.planning.sidebar.assignment.busy", dict),
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
  const truckTypeLabel = tr(
    `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
    dict
  );
  const subtitle = `${truck.marca} · ${truckTypeLabel}`;

  return (
    <VehicleCardButton
      isHighlighted={isHighlighted}
      isSelected={isSelected}
      isAvailable={isAvailable}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Header: Plate + Brand + Type + GPS Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <VehicleHeader
          plate={truck.plate}
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
          label={tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          value={truck.viajesPrevios}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          value={truck.ultimoViaje}
        />
      </div>

      {/* Signal losses - only show if there are any */}
      <WarningBadge
        count={truck.perdidasSenal}
        labelKey="pages.planning.sidebar.assignment.signalLosses"
        dict={dict}
      />
    </VehicleCardButton>
  );
}

// ============================================================================
// Selected Button Renderer
// ============================================================================

function renderSelectedTruckButton(truck: CamionOption, dict: I18nRecord) {
  const isGpsIntegrado = truck.gpsIntegrado;
  const isOnline = truck.estadoGps === "online";
  const truckTypeLabel = tr(
    `pages.planning.sidebar.assignment.truckType.${truck.tipo}`,
    dict
  );
  const subtitle = `${truck.marca} · ${truckTypeLabel}`;

  return (
    <div className="flex flex-col">
      {/* Header with plate, brand, type, GPS status, and chevron */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <VehicleHeader plate={truck.plate} subtitle={subtitle} isSelected />
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
          label={tr("pages.planning.sidebar.assignment.previousTrips", dict)}
          value={truck.viajesPrevios}
        />
        <StatRow
          label={tr("pages.planning.sidebar.assignment.lastTrip", dict)}
          value={truck.ultimoViaje}
        />
      </div>

      {/* Signal losses - only show if there are any */}
      <WarningBadge
        count={truck.perdidasSenal}
        labelKey="pages.planning.sidebar.assignment.signalLosses"
        dict={dict}
      />
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
