"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Checkbox } from "flowbite-react";
import MapVisualization from "@/features/map-visualization/map-visualization";
import type { MapRef } from "react-map-gl";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  useAccreditedResources,
  type AccreditedResource,
} from "@/features/calendar/services/accredited-resources.service";
import { DriverSearchDropdown } from "./driver-search-dropdown";
import {
  TransportistaSearchDropdown,
  type TransportistaOption,
} from "./transportista-search-dropdown";
import {
  TruckSearchDropdown,
  type CamionOption,
} from "./truck-search-dropdown";
import {
  RemolqueSearchDropdown,
  type RemolqueOption,
} from "./remolque-search-dropdown";

export interface ConductorOption {
  id: string;
  name: string;
  rut: string;
  estado: "habilitado" | "no habilitado";
  viajesPrevios: number;
  ultimoViaje: string;
  excesoVelocidad: number;
  faltasDescanso: number;
}

const REMOLQUE_OPTIONS: RemolqueOption[] = [
  {
    id: "r1",
    plate: "AABB11",
    tipo: "FURG",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 25000,
    ultimoMantenimiento: "2026-02-15",
    kilometraje: 85000,
    problemasReportados: 0,
  },
  {
    id: "r2",
    plate: "CCDD22",
    tipo: "CB40",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "offline",
    capacidadKg: 30000,
    ultimoMantenimiento: "2026-01-20",
    kilometraje: 120000,
    problemasReportados: 2,
  },
  {
    id: "r3",
    plate: "EEFF33",
    tipo: "R28T",
    estado: "disponible",
    gpsIntegrado: false,
    estadoGps: "offline",
    capacidadKg: 20000,
    ultimoMantenimiento: "2026-03-01",
    kilometraje: 45000,
    problemasReportados: 0,
  },
  {
    id: "r4",
    plate: "GGHH44",
    tipo: "SIDE",
    estado: "ocupado",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 18000,
    ultimoMantenimiento: "2026-02-28",
    kilometraje: 67000,
    problemasReportados: 1,
  },
  {
    id: "r5",
    plate: "IIJJ55",
    tipo: "SIL",
    estado: "disponible",
    gpsIntegrado: true,
    estadoGps: "online",
    capacidadKg: 35000,
    ultimoMantenimiento: "2026-03-10",
    kilometraje: 92000,
    problemasReportados: 0,
  },
];

interface TruckMapDisplayProps {
  readonly camion: CamionOption;
}

function TruckMapDisplay({ camion }: TruckMapDisplayProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Create pin layer for truck location
  const layers = useMemo(() => {
    if (camion.latitude == null || camion.longitude == null) return [];

    return [
      new PinLayer({
        id: "truck-pin-layer",
        data: [
          {
            assetid: camion.id,
            latitude: camion.latitude,
            longitude: camion.longitude,
            heading: camion.heading,
            speed: 0,
            location: camion.plate,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ];
  }, [camion]);

  // Center map on truck location when map is loaded or truck changes
  useEffect(() => {
    if (
      isMapLoaded &&
      mapRef.current &&
      camion.latitude != null &&
      camion.longitude != null
    ) {
      mapRef.current.flyTo({
        center: [camion.longitude, camion.latitude],
        zoom: 14,
        duration: 500,
      });
    }
  }, [camion, isMapLoaded]);

  // Handle map load to trigger initial centering
  const handleZoomChange = useCallback(() => {
    // First zoom change means map is loaded
    setIsMapLoaded(true);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="h-48 w-full">
        <MapVisualization
          mapStyle="streets"
          layers={layers}
          mapRef={mapRef}
          onZoomChange={handleZoomChange}
        />
      </div>
    </div>
  );
}

export interface AssignmentFormData {
  transportista: string;
  conductor: string;
  segundoConductor: string;
  hasSegundoConductor: boolean;
  camion: string;
  remolque: string;
  hasRemolque: boolean;
}

interface AssignmentFormProps {
  readonly value: AssignmentFormData;
  readonly onChange: (data: AssignmentFormData) => void;
  readonly dict: I18nRecord;
  /** Client RUT of the mandante — drives the `p_rut_mandante` filter. */
  readonly mintralClientRut?: string;
  /** Delegation/origin code — drives the `p_delegacion` filter. */
  readonly mintralDelegacionOrigen?: string;
}

/**
 * Map an `ams.fn_rd_accredited_resources` CARRIER row to the shape expected by
 * `TransportistaSearchDropdown`. The upstream function returns both accredited
 * and non-accredited carriers; `is_acredited` drives the UI badge. Both states
 * are surfaced and selectable — the planner sees accreditation as context, not
 * as a hard block.
 */
function carrierRowToOption(row: AccreditedResource): TransportistaOption {
  const rut = row.identifier ?? "";
  return {
    id: row.resource_id,
    name: row.resource_name ?? rut,
    rut,
    estado: row.is_acredited === "ACREDITED" ? "habilitado" : "no habilitado",
  };
}

/**
 * Map an `ams.fn_rd_accredited_resources` TRUCK row onto the existing
 * `CamionOption` shape. The upstream function does not carry GPS/telemetry
 * fields, so `gpsIntegrado`, `estadoGps`, lat/lng and `heading` default to a
 * "no signal" baseline. `estado` piggybacks on `is_acredited` (ACREDITED →
 * `disponible`, NOT ACREDITED → `ocupado`) to reuse the existing UI badge
 * without introducing a parallel state flag.
 */
function truckRowToOption(row: AccreditedResource): CamionOption {
  const plate = row.identifier ?? "";
  const symptoms = row.symptoms ?? {};
  const ultimoViaje = row.last_trip ? row.last_trip.slice(0, 10) : "-";
  return {
    id: row.resource_id,
    plate,
    marca: row.resource_name ?? "",
    tipo: "camion",
    estado: row.is_acredited === "ACREDITED" ? "disponible" : "ocupado",
    gpsIntegrado: false,
    estadoGps: "offline",
    viajesPrevios: row.trip_count ?? 0,
    ultimoViaje,
    perdidasSenal: symptoms["Lost Signal"] ?? 0,
    latitude: null,
    longitude: null,
    heading: 0,
  };
}

/**
 * Map an `ams.fn_rd_accredited_resources` DRIVER row onto the existing
 * `ConductorOption` shape. The upstream row carries `trip_count`, `last_trip`
 * (ISO timestamp) and a free-form `symptoms` JSON keyed by symptom name;
 * the two counters the driver card renders today are derived from the
 * matching symptom buckets — defaulting to 0 when missing.
 */
function driverRowToOption(row: AccreditedResource): ConductorOption {
  const rut = row.identifier ?? "";
  const symptoms = row.symptoms ?? {};
  const ultimoViaje = row.last_trip ? row.last_trip.slice(0, 10) : "-";
  return {
    id: row.resource_id,
    name: row.resource_name ?? rut,
    rut,
    estado: row.is_acredited === "ACREDITED" ? "habilitado" : "no habilitado",
    viajesPrevios: row.trip_count ?? 0,
    ultimoViaje,
    excesoVelocidad: symptoms["Speed Limit Standard"] ?? 0,
    faltasDescanso:
      (symptoms["Continuous Drive Check"] ?? 0) +
      (symptoms["Continuous Resting Check"] ?? 0),
  };
}

export function AssignmentForm({
  value,
  onChange,
  dict,
  mintralClientRut,
  mintralDelegacionOrigen,
}: AssignmentFormProps) {
  const [carrierQuery, setCarrierQuery] = useState("");
  const [driverQuery, setDriverQuery] = useState("");
  const [truckQuery, setTruckQuery] = useState("");

  const {
    resources: accreditedCarriers,
    loadMore: loadMoreCarriers,
    isLoadingMore: isLoadingMoreCarriers,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "CARRIER",
    query: carrierQuery,
  });

  const {
    resources: accreditedDrivers,
    loadMore: loadMoreDrivers,
    isLoadingMore: isLoadingMoreDrivers,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "DRIVER",
    carrierId: value.transportista,
    query: driverQuery,
    enabled: Boolean(value.transportista),
  });

  const {
    resources: accreditedTrucks,
    loadMore: loadMoreTrucks,
    isLoadingMore: isLoadingMoreTrucks,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "TRUCK",
    carrierId: value.transportista,
    query: truckQuery,
    enabled: Boolean(value.transportista),
  });

  const transportistaOptions = useMemo(
    () => accreditedCarriers.map(carrierRowToOption),
    [accreditedCarriers]
  );

  const driverOptions = useMemo(
    () => accreditedDrivers.map(driverRowToOption),
    [accreditedDrivers]
  );

  const truckOptions = useMemo(
    () => accreditedTrucks.map(truckRowToOption),
    [accreditedTrucks]
  );

  const selectedCamion = truckOptions.find((c) => c.id === value.camion);

  const handleChange = (
    field: keyof AssignmentFormData,
    fieldValue: string | boolean
  ) => {
    const updated = { ...value, [field]: fieldValue };

    // Drivers/trucks are scoped to the selected carrier — clear those slots
    // when the carrier changes so a stale (carrier, child) pair can't silently
    // survive. `remolque` uses the same rule for symmetry.
    if (field === "transportista" && fieldValue !== value.transportista) {
      updated.conductor = "";
      updated.segundoConductor = "";
      updated.camion = "";
      setDriverQuery("");
      setTruckQuery("");
    }

    // When changing conductor, clear segundoConductor if it matches the new value
    // or if the second driver section is disabled
    if (field === "conductor" && typeof fieldValue === "string") {
      if (
        updated.segundoConductor === fieldValue ||
        !updated.hasSegundoConductor
      ) {
        updated.segundoConductor = "";
      }
    }

    // When disabling second conductor section, clear the selection
    if (field === "hasSegundoConductor" && fieldValue === false) {
      updated.segundoConductor = "";
    }

    // When disabling remolque section, clear the selection
    if (field === "hasRemolque" && fieldValue === false) {
      updated.remolque = "";
    }

    onChange(updated);
  };

  return (
    <div className="rounded-lg flex flex-col gap-4">
      {/* Transportista Dropdown */}
      <TransportistaSearchDropdown
        label={tr("pages.planning.sidebar.assignment.transportista", dict)}
        transportistas={transportistaOptions}
        selectedTransportistaId={value.transportista}
        onSelect={(v: string) => handleChange("transportista", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectTransportista",
          dict
        )}
        dict={dict}
        onQueryChange={setCarrierQuery}
        onReachEnd={loadMoreCarriers}
        isLoadingMore={isLoadingMoreCarriers}
      />

      {/* Conductor Dropdown */}
      <DriverSearchDropdown
        label={tr("pages.planning.sidebar.assignment.conductor", dict)}
        drivers={driverOptions}
        selectedDriverId={value.conductor}
        onSelect={(v: string) => handleChange("conductor", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectConductor",
          dict
        )}
        dict={dict}
        disabled={!value.transportista}
        onQueryChange={setDriverQuery}
        onReachEnd={loadMoreDrivers}
        isLoadingMore={isLoadingMoreDrivers}
        labelRightElement={
          <label className="flex items-center gap-1 cursor-pointer">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {tr(
                "pages.planning.sidebar.assignment.secondConductorLabel",
                dict
              )}
            </span>
            <Checkbox
              id="segundo-conductor-check"
              checked={value.hasSegundoConductor}
              onChange={(e) =>
                handleChange("hasSegundoConductor", e.target.checked)
              }
              className="w-3 h-3"
            />
          </label>
        }
      />

      {/* Second Conductor Dropdown (conditional) */}
      {value.hasSegundoConductor && (
        <DriverSearchDropdown
          label={tr("pages.planning.sidebar.assignment.secondConductor", dict)}
          drivers={driverOptions}
          selectedDriverId={value.segundoConductor}
          onSelect={(v: string) => handleChange("segundoConductor", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectSecondConductor",
            dict
          )}
          dict={dict}
          disabled={!value.transportista}
          onQueryChange={setDriverQuery}
          onReachEnd={loadMoreDrivers}
          isLoadingMore={isLoadingMoreDrivers}
          excludeDriverId={value.conductor}
        />
      )}

      {/* Camión Dropdown */}
      <div>
        <TruckSearchDropdown
          label={tr("pages.planning.sidebar.assignment.camion", dict)}
          trucks={truckOptions}
          selectedTruckId={value.camion}
          onSelect={(v: string) => handleChange("camion", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectCamion",
            dict
          )}
          dict={dict}
          disabled={!value.transportista}
          onQueryChange={setTruckQuery}
          onReachEnd={loadMoreTrucks}
          isLoadingMore={isLoadingMoreTrucks}
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.assignment.remolqueLabel", dict)}
              </span>
              <Checkbox
                id="remolque-check"
                checked={value.hasRemolque}
                onChange={(e) => handleChange("hasRemolque", e.target.checked)}
                className="w-3 h-3"
              />
            </label>
          }
        />
        {selectedCamion && <TruckMapDisplay camion={selectedCamion} />}
      </div>

      {/* Remolque Dropdown (conditional) */}
      {value.hasRemolque && (
        <RemolqueSearchDropdown
          label={tr("pages.planning.sidebar.assignment.remolque", dict)}
          remolques={REMOLQUE_OPTIONS}
          selectedRemolqueId={value.remolque}
          onSelect={(v: string) => handleChange("remolque", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectRemolque",
            dict
          )}
          dict={dict}
        />
      )}
    </div>
  );
}
