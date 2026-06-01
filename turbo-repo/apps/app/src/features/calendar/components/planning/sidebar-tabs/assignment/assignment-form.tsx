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
import {
  toAccreditationLevel,
  type AccreditationLevel,
} from "./accreditation";
import { DriverSearchDropdown } from "./driver-search-dropdown";
import {
  CarrierSearchDropdown,
  type CarrierOption,
} from "./carrier-search-dropdown";
import {
  TruckSearchDropdown,
  type TruckOption,
} from "./truck-search-dropdown";
import {
  TrailerSearchDropdown,
  type TrailerOption,
} from "./trailer-search-dropdown";

export interface DriverOption {
  id: string;
  name: string;
  rut: string;
  /**
   * Upstream `cond_codigo` from `ams.fn_rd_accredited_resources.external_id`.
   * Populated for symmetry with `CarrierOption`; not yet routed downstream
   * (driver Alerce contract — `conductor` field — still expects RUT today).
   */
  externalId: string | null;
  acreditacion: AccreditationLevel;
  viajesPrevios: number;
  ultimoViaje: string;
  excesoVelocidad: number;
  faltasDescanso: number;
}

/**
 * Default `tipo` for trailers fetched from `ams.fn_rd_accredited_resources`.
 * The upstream row has no trailer-type field today; until it does, every row
 * is mapped to `"REM"` (generic remolque) — the dropdown still renders, the
 * i18n key resolves, and a follow-up can replace this once the backend
 * surfaces the real type.
 */
const TRAILER_TIPO_FALLBACK = "REM" as const;

interface TruckMapDisplayProps {
  readonly truck: TruckOption;
}

function TruckMapDisplay({ truck }: TruckMapDisplayProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Create pin layer for truck location
  const layers = useMemo(() => {
    if (truck.latitude == null || truck.longitude == null) return [];

    return [
      new PinLayer({
        id: "truck-pin-layer",
        data: [
          {
            assetid: truck.id,
            latitude: truck.latitude,
            longitude: truck.longitude,
            heading: truck.heading,
            speed: 0,
            location: truck.plate,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    ];
  }, [truck]);

  // Center map on truck location when map is loaded or truck changes
  useEffect(() => {
    if (
      isMapLoaded &&
      mapRef.current &&
      truck.latitude != null &&
      truck.longitude != null
    ) {
      mapRef.current.flyTo({
        center: [truck.longitude, truck.latitude],
        zoom: 14,
        duration: 500,
      });
    }
  }, [truck, isMapLoaded]);

  // Handle map load to trigger initial centering
  const handleZoomChange = useCallback(() => {
    // First zoom change means map is loaded
    setIsMapLoaded(true);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="h-48 w-full">
        <MapVisualization
          mapStyle="satellite"
          layers={layers}
          mapRef={mapRef}
          onZoomChange={handleZoomChange}
        />
      </div>
    </div>
  );
}

export interface AssignmentFormData {
  carrier: string;
  /**
   * Carrier's upstream `prve_codigo` from
   * `AccreditedResource.external_id`, captured alongside the UUID on every
   * carrier change. Travels up to `assignmentOverrides` so the booking
   * carries `assignedCarrierExternalId`. `null` when the selected carrier
   * has no upstream code on file, or when no carrier is selected.
   */
  carrierExternalId: string | null;
  driver: string;
  secondDriver: string;
  hasSecondDriver: boolean;
  truck: string;
  trailer: string;
  hasTrailer: boolean;
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
 * Upstream symptom names emitted by `public.symptoms.symptom_name` and
 * aggregated into the `symptoms` JSONB by `ams.fn_rd_accredited_resources`.
 * Kept as typed constants so the handful of literal keys the mappers look
 * up — rather than being sprinkled as magic strings — live in one place and
 * fail typecheck the moment the upstream contract is renamed. See
 * `db-scripts/outputs/erick/modular_recursos/fn_rd_accredited_resources_v2.sql`
 * for the source enumeration.
 */
const SYMPTOM_LOST_SIGNAL = "Lost Signal" as const;
const SYMPTOM_SPEED_LIMIT = "Speed Limit Standard" as const;
const SYMPTOM_CONT_DRIVE = "Continuous Drive Check" as const;
const SYMPTOM_CONT_REST = "Continuous Resting Check" as const;

/**
 * Format a `last_trip` ISO-8601 timestamp (as returned by PostgREST) for the
 * "Último viaje" row on carrier/driver/truck cards.
 *
 * Uses `es-CL` + the browser's local timezone so a 2026-04-10T01:40Z trip in
 * Santiago renders as April 9 — which matches the planner's day instead of
 * the upstream UTC date. Returns `"-"` when the value is missing or not
 * parseable, so a malformed string from the API can't leak into the UI.
 */
const LAST_TRIP_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatLastTrip(raw: string | null | undefined): string {
  if (!raw) return "-";
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return "-";
  return LAST_TRIP_FORMATTER.format(new Date(t));
}

/**
 * Map an `ams.fn_rd_accredited_resources` CARRIER row to the shape expected by
 * `CarrierSearchDropdown`. The upstream function returns carriers in every
 * accreditation state; `is_acredited` drives the UI badge. All states are
 * surfaced and selectable — the planner sees accreditation as context, not as
 * a hard block.
 */
function carrierRowToOption(row: AccreditedResource): CarrierOption {
  const rut = row.identifier ?? "";
  return {
    id: row.resource_id,
    name: row.resource_name ?? rut,
    rut,
    externalId: row.external_id,
    acreditacion: toAccreditationLevel(row.is_acredited),
  };
}

/**
 * Map an `ams.fn_rd_accredited_resources` TRUCK row onto the existing
 * `TruckOption` shape. The upstream row carries `integration` (GPS plumbing
 * flag) and `location` (EWKB hex of the last-known position); the route
 * handler decodes the latter into `latitude`/`longitude` so the dropdown's
 * map preview can drop a pin. `gpsIntegrado` is driven by `integration`
 * (independent of whether a recent position is on file); `estadoGps`
 * reflects coordinate availability — `online` only when we have something
 * to plot. `acreditacion` carries the upstream `is_acredited` state through
 * to the shared accreditation badge.
 */
function truckRowToOption(row: AccreditedResource): TruckOption {
  const plate = row.identifier ?? "";
  const symptoms = row.symptoms ?? {};
  const latitude = row.latitude ?? null;
  const longitude = row.longitude ?? null;
  const hasPosition = latitude != null && longitude != null;
  return {
    id: row.resource_id,
    plate,
    externalId: row.external_id,
    marca: row.resource_name ?? "",
    tipo: "truck",
    acreditacion: toAccreditationLevel(row.is_acredited),
    gpsIntegrado: row.integration === "INTEGRATED",
    estadoGps: hasPosition ? "online" : "offline",
    viajesPrevios: row.trip_count ?? 0,
    ultimoViaje: formatLastTrip(row.last_trip),
    perdidasSenal: symptoms[SYMPTOM_LOST_SIGNAL] ?? 0,
    latitude,
    longitude,
    heading: row.heading ?? 0,
  };
}

/**
 * Map an `ams.fn_rd_accredited_resources` TRAILER row onto the existing
 * `TrailerOption` shape. Mirrors `truckRowToOption`: `acreditacion` rides on
 * `is_acredited`, GPS defaults to "no signal", and `problemasReportados`
 * surfaces lost-signal counts from the symptoms bag. The numeric fleet
 * fields (`capacidadKg`, `kilometraje`) and `ultimoMantenimiento` are not
 * carried by the upstream function, so they default to placeholder values
 * until the backend is extended. `tipo` falls back to `REM` for the same
 * reason — see `TRAILER_TIPO_FALLBACK`.
 */
function trailerRowToOption(row: AccreditedResource): TrailerOption {
  const plate = row.identifier ?? "";
  const symptoms = row.symptoms ?? {};
  return {
    id: row.resource_id,
    plate,
    externalId: row.external_id,
    tipo: TRAILER_TIPO_FALLBACK,
    acreditacion: toAccreditationLevel(row.is_acredited),
    gpsIntegrado: false,
    estadoGps: "offline",
    capacidadKg: 0,
    ultimoMantenimiento: "-",
    kilometraje: 0,
    problemasReportados: symptoms[SYMPTOM_LOST_SIGNAL] ?? 0,
  };
}

/**
 * Map an `ams.fn_rd_accredited_resources` DRIVER row onto the existing
 * `DriverOption` shape. The upstream row carries `trip_count`, `last_trip`
 * (ISO timestamp) and a free-form `symptoms` JSON keyed by symptom name;
 * the two counters the driver card renders today are derived from the
 * matching symptom buckets — defaulting to 0 when missing.
 */
function driverRowToOption(row: AccreditedResource): DriverOption {
  const rut = row.identifier ?? "";
  const symptoms = row.symptoms ?? {};
  return {
    id: row.resource_id,
    name: row.resource_name ?? rut,
    rut,
    externalId: row.external_id,
    acreditacion: toAccreditationLevel(row.is_acredited),
    viajesPrevios: row.trip_count ?? 0,
    ultimoViaje: formatLastTrip(row.last_trip),
    excesoVelocidad: symptoms[SYMPTOM_SPEED_LIMIT] ?? 0,
    faltasDescanso:
      (symptoms[SYMPTOM_CONT_DRIVE] ?? 0) + (symptoms[SYMPTOM_CONT_REST] ?? 0),
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
  const [trailerQuery, setTrailerQuery] = useState("");

  const {
    resources: accreditedCarriers,
    loadMore: loadMoreCarriers,
    isLoadingMore: isLoadingMoreCarriers,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "CARRIER",
    query: carrierQuery,
    selectedIds: value.carrier ? [value.carrier] : undefined,
  });

  const {
    resources: accreditedDrivers,
    loadMore: loadMoreDrivers,
    isLoadingMore: isLoadingMoreDrivers,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "DRIVER",
    carrierId: value.carrier,
    query: driverQuery,
    // The driver feed backs both the primary and the second-driver dropdown,
    // so pin whichever of the two is currently selected.
    selectedIds: [value.driver, value.secondDriver].filter(Boolean),
    enabled: Boolean(value.carrier),
  });

  const {
    resources: accreditedTrucks,
    loadMore: loadMoreTrucks,
    isLoadingMore: isLoadingMoreTrucks,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "TRUCK",
    carrierId: value.carrier,
    query: truckQuery,
    selectedIds: value.truck ? [value.truck] : undefined,
    enabled: Boolean(value.carrier),
  });

  const {
    resources: accreditedTrailers,
    loadMore: loadMoreTrailers,
    isLoadingMore: isLoadingMoreTrailers,
  } = useAccreditedResources({
    rutMandante: mintralClientRut,
    delegacion: mintralDelegacionOrigen,
    resourceType: "TRAILER",
    carrierId: value.carrier,
    query: trailerQuery,
    selectedIds: value.trailer ? [value.trailer] : undefined,
    enabled: Boolean(value.carrier && value.hasTrailer),
  });

  const carrierOptions = useMemo(
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

  const trailerOptions = useMemo(
    () => accreditedTrailers.map(trailerRowToOption),
    [accreditedTrailers]
  );

  const selectedCamion = truckOptions.find((c) => c.id === value.truck);

  const handleChange = (
    field: keyof AssignmentFormData,
    fieldValue: string | boolean
  ) => {
    const updated = { ...value, [field]: fieldValue };

    // Drivers/trucks/trailers are scoped to the selected carrier — clear
    // those slots when the carrier changes so a stale (carrier, child) pair
    // can't silently survive. Refresh `carrierExternalId` from the matching
    // row (or null when the new value is empty / row not yet in the page) so
    // the upstream prve_codigo travels with the UUID.
    if (field === "carrier" && fieldValue !== value.carrier) {
      updated.driver = "";
      updated.secondDriver = "";
      updated.truck = "";
      updated.trailer = "";
      setDriverQuery("");
      setTruckQuery("");
      setTrailerQuery("");
      updated.carrierExternalId =
        typeof fieldValue === "string" && fieldValue.length > 0
          ? accreditedCarriers.find((row) => row.resource_id === fieldValue)
              ?.external_id ?? null
          : null;
    }

    // When changing driver, clear secondDriver if it matches the new value
    // or if the second driver section is disabled
    if (field === "driver" && typeof fieldValue === "string") {
      if (
        updated.secondDriver === fieldValue ||
        !updated.hasSecondDriver
      ) {
        updated.secondDriver = "";
      }
    }

    // When disabling second driver section, clear the selection
    if (field === "hasSecondDriver" && fieldValue === false) {
      updated.secondDriver = "";
    }

    // When disabling trailer section, clear the selection and search.
    if (field === "hasTrailer" && fieldValue === false) {
      updated.trailer = "";
      setTrailerQuery("");
    }

    onChange(updated);
  };

  return (
    <div className="rounded-lg flex flex-col gap-4">
      {/* Transportista Dropdown */}
      <CarrierSearchDropdown
        label={tr("pages.planning.sidebar.assignment.carrier", dict)}
        carriers={carrierOptions}
        selectedCarrierId={value.carrier}
        onSelect={(v: string) => handleChange("carrier", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectCarrier",
          dict
        )}
        dict={dict}
        onQueryChange={setCarrierQuery}
        onReachEnd={loadMoreCarriers}
        isLoadingMore={isLoadingMoreCarriers}
      />

      {/* Conductor Dropdown */}
      <DriverSearchDropdown
        label={tr("pages.planning.sidebar.assignment.driver", dict)}
        drivers={driverOptions}
        selectedDriverId={value.driver}
        onSelect={(v: string) => handleChange("driver", v)}
        placeholder={tr(
          "pages.planning.sidebar.assignment.selectDriver",
          dict
        )}
        dict={dict}
        disabled={!value.carrier}
        onQueryChange={setDriverQuery}
        onReachEnd={loadMoreDrivers}
        isLoadingMore={isLoadingMoreDrivers}
        labelRightElement={
          <label className="flex items-center gap-1 cursor-pointer">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {tr(
                "pages.planning.sidebar.assignment.secondDriverLabel",
                dict
              )}
            </span>
            <Checkbox
              id="segundo-driver-check"
              checked={value.hasSecondDriver}
              onChange={(e) =>
                handleChange("hasSecondDriver", e.target.checked)
              }
              className="w-3 h-3"
            />
          </label>
        }
      />

      {/* Second Conductor Dropdown (conditional) */}
      {value.hasSecondDriver && (
        <DriverSearchDropdown
          label={tr("pages.planning.sidebar.assignment.secondDriver", dict)}
          drivers={driverOptions}
          selectedDriverId={value.secondDriver}
          onSelect={(v: string) => handleChange("secondDriver", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectSecondDriver",
            dict
          )}
          dict={dict}
          disabled={!value.carrier}
          onQueryChange={setDriverQuery}
          onReachEnd={loadMoreDrivers}
          isLoadingMore={isLoadingMoreDrivers}
          excludeDriverId={value.driver}
        />
      )}

      {/* Camión Dropdown */}
      <div>
        <TruckSearchDropdown
          label={tr("pages.planning.sidebar.assignment.truck", dict)}
          trucks={truckOptions}
          selectedTruckId={value.truck}
          onSelect={(v: string) => handleChange("truck", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectTruck",
            dict
          )}
          dict={dict}
          disabled={!value.carrier}
          onQueryChange={setTruckQuery}
          onReachEnd={loadMoreTrucks}
          isLoadingMore={isLoadingMoreTrucks}
          labelRightElement={
            <label className="flex items-center gap-1 cursor-pointer">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {tr("pages.planning.sidebar.assignment.trailerLabel", dict)}
              </span>
              <Checkbox
                id="trailer-check"
                checked={value.hasTrailer}
                onChange={(e) => handleChange("hasTrailer", e.target.checked)}
                className="w-3 h-3"
              />
            </label>
          }
        />
        {selectedCamion && <TruckMapDisplay truck={selectedCamion} />}
      </div>

      {/* Remolque Dropdown (conditional) */}
      {value.hasTrailer && (
        <TrailerSearchDropdown
          label={tr("pages.planning.sidebar.assignment.trailer", dict)}
          trailers={trailerOptions}
          selectedTrailerId={value.trailer}
          onSelect={(v: string) => handleChange("trailer", v)}
          placeholder={tr(
            "pages.planning.sidebar.assignment.selectTrailer",
            dict
          )}
          dict={dict}
          disabled={!value.carrier}
          onQueryChange={setTrailerQuery}
          onReachEnd={loadMoreTrailers}
          isLoadingMore={isLoadingMoreTrailers}
        />
      )}
    </div>
  );
}
