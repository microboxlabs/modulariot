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
import { IconLayer } from "deck.gl";
import type { Layer } from "@deck.gl/core";
import pin_atlas from "@assets/icons/map/pin-atlas.png";
import { icon_definition } from "@/features/geographic-view/components/geofence_pin";
import { useGeofenceCoords } from "@/features/calendar/services/geofence-coords.service";
import { haversineKm } from "@/features/calendar/utils/distance";
import {
  useLiveETA,
  formatDuration,
} from "@/features/common/providers/client-api.provider";

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
  /** Origin geofence name (service `origen`) — places the origin flag. */
  readonly originName?: string;
  /** Destination geofence name (service `destino`) — places the end flag. */
  readonly destinationName?: string;
  readonly dict: I18nRecord;
}

function TruckMapDisplay({
  truck,
  originName,
  destinationName,
  dict,
}: TruckMapDisplayProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Resolve origin/destination geofence names to centroids (for the flags +
  // distance) and the origin→destination route ETA.
  const { originCoord, destinationCoord } = useGeofenceCoords(
    originName,
    destinationName
  );
  const { eta } = useLiveETA(
    Boolean(originName && destinationName),
    originName,
    destinationName
  );

  const truckLng = truck.longitude;
  const truckLat = truck.latitude;
  const hasTruck = truckLat != null && truckLng != null;

  // Truck pin + origin (start) / destination (finish) flags, reusing the trip
  // map's pin atlas.
  const layers = useMemo(() => {
    const result: Layer[] = [];

    const flagData: Array<{ position: [number, number]; icon: string }> = [];
    if (originCoord) {
      flagData.push({
        position: [originCoord.longitude, originCoord.latitude],
        icon: "start_pin",
      });
    }
    if (destinationCoord) {
      flagData.push({
        position: [destinationCoord.longitude, destinationCoord.latitude],
        icon: "finish_pin",
      });
    }
    if (flagData.length > 0) {
      result.push(
        new IconLayer({
          id: "assignment-geofence-flags",
          data: flagData,
          getIcon: (d: { icon: string }) => d.icon,
          getPosition: (d: { position: [number, number] }) => d.position,
          iconAtlas: pin_atlas.src,
          iconMapping: icon_definition,
          getSize: () => 35,
          sizeScale: 1,
          parameters: { depthTest: false },
        })
      );
    }

    if (hasTruck) {
      result.push(
        new PinLayer({
          id: "truck-pin-layer",
          data: [
            {
              assetid: truck.id,
              latitude: truckLat as number,
              longitude: truckLng as number,
              heading: truck.heading,
              speed: 0,
              location: truck.plate,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      );
    }

    return result;
  }, [truck, truckLat, truckLng, hasTruck, originCoord, destinationCoord]);

  // Fit the viewport to every point we have (truck + origin + destination).
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const pts: [number, number][] = [];
    if (hasTruck) pts.push([truckLng as number, truckLat as number]);
    if (originCoord) pts.push([originCoord.longitude, originCoord.latitude]);
    if (destinationCoord) {
      pts.push([destinationCoord.longitude, destinationCoord.latitude]);
    }
    if (pts.length === 0) return;
    if (pts.length === 1) {
      mapRef.current.flyTo({ center: pts[0], zoom: 13, duration: 500 });
      return;
    }
    let [minLng, minLat] = pts[0];
    let [maxLng, maxLat] = pts[0];
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    mapRef.current.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 48, duration: 500, maxZoom: 14 }
    );
  }, [isMapLoaded, hasTruck, truckLat, truckLng, originCoord, destinationCoord]);

  const handleZoomChange = useCallback(() => setIsMapLoaded(true), []);

  const distanceToOriginKm =
    hasTruck && originCoord
      ? haversineKm(
          [truckLng as number, truckLat as number],
          [originCoord.longitude, originCoord.latitude]
        )
      : null;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="relative h-48 w-full">
        <MapVisualization
          mapStyle="satellite"
          layers={layers}
          mapRef={mapRef}
          onZoomChange={handleZoomChange}
        />
        {(distanceToOriginKm != null || eta) && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-[600] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-xs shadow dark:border-gray-700 dark:bg-gray-800/90">
            {distanceToOriginKm != null && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">
                  {tr(
                    "pages.planning.sidebar.assignment.distanceToOrigin",
                    dict
                  )}
                  :
                </span>
                <span>{distanceToOriginKm.toFixed(1)} km</span>
              </span>
            )}
            {distanceToOriginKm != null && eta && (
              <span className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
            )}
            {eta && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">
                  {tr("pages.planning.sidebar.assignment.etaTrip", dict)}:
                </span>
                <span>{formatDuration(eta)}</span>
              </span>
            )}
          </div>
        )}
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
  /** Origin geofence name (service `origen`) — places the origin flag. */
  readonly originGeofenceName?: string;
  /** Destination geofence name (service `destino`) — places the end flag. */
  readonly destinationGeofenceName?: string;
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
  originGeofenceName,
  destinationGeofenceName,
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
        {selectedCamion && (
          <TruckMapDisplay
            truck={selectedCamion}
            originName={originGeofenceName}
            destinationName={destinationGeofenceName}
            dict={dict}
          />
        )}
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
