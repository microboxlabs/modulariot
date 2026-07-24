"use client";

import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from "react-icons/hi2";
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import VehicleStatusBadge from "../vehicle-grid/vehicle-status-badge";
import { useEstadoOperacional, EstadoOperacionalChip } from "@/features/ams/estado-operacional";
import { AccionesRapidas } from "@/features/ams/acciones-rapidas";
import { SiluetaCamion } from "@/features/ams/silueta-activo";
import { useAmsRecord, type AmsTruck } from "@/features/ams/ficha-ams";
import { useSaludVehiculo } from "./super-profile-salud";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { HiClipboardList } from "react-icons/hi";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import LastSignalMapPopover from "./last-signal-map-popover";

interface VehicleDetailHeaderProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly hasPrevious?: boolean;
  readonly hasNext?: boolean;
  readonly onBack: () => void;
}

export default function VehicleDetailHeader({
  vehicle,
  dict,
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
  onBack,
}: VehicleDetailHeaderProps) {
  // Estado operacional VIVO (doc rector §1/§4): En viaje / Disponible /
  // En taller / Bloqueado / Inactivo, derivado de maestro + live_trip.
  const { estado } = useEstadoOperacional("TRUCK", vehicle.plate);
  // El header ES el resumen ejecutivo (decisión 2026-07-24: la fila KPI
  // duplicaba esta lectura): conductor, salud y conectividad viven aquí.
  const { rec } = useAmsRecord("TRUCK", vehicle.plate);
  const conductor = (rec as AmsTruck | undefined)?.conductor?.nombre;
  const { statuses, healthScore, telemetry } = useSaludVehiculo(vehicle.plate);
  const alertas = Object.values(statuses).filter((x) => x !== "ok").length;
  const freshness = telemetry?.signal.freshness ?? "SIN_SENAL";
  return (
    <div className="bg-white dark:bg-gray-800 p-4 flex flex-col gap-3 border-b border-gray-200 dark:border-gray-700 w-full">
      <ClientBreadcrumb
        path={[
          { label: "breadcrumb.fleetManagement", href: "/fleet-management" },
          vehicle.plate,
        ]}
        rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
        dict={dict}
      />
      <div className="flex items-center justify-between gap-4 ">
        {/* Left: Vehicle info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Silueta según tipo de equipo del maestro (F5) */}
          <SiluetaCamion plate={vehicle.plate} />

          {/* Details row */}
          <div className="flex items-center gap-x-6 gap-y-2 flex-1 min-w-0 flex-wrap">
            {/* Plate */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.plate", dict)}
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {vehicle.plate}
              </span>
            </div>

            {/* Model + Brand */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.model", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.brand} {vehicle.model}
              </span>
            </div>

            {/* Status maestro */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.status", dict)}
              </span>
              <VehicleStatusBadge status={vehicle.status} dict={dict} />
            </div>

            {/* Estado operacional (ahora mismo) */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">Ahora</span>
              <EstadoOperacionalChip estado={estado} />
            </div>

            {/* Conductor asignado (dupla del maestro) */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">Conductor</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {conductor ?? "Sin asignar"}
              </span>
            </div>

            {/* Salud (score del acordeón, ahora señal del header) */}
            <div className="flex flex-col shrink-0" title={alertas
              ? `${alertas} ${alertas === 1 ? "sección requiere" : "secciones requieren"} atención`
              : "todas las secciones al día"}>
              <span className="text-xs text-gray-500 dark:text-gray-400">Salud</span>
              <span className={`text-sm font-bold ${alertas
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400"}`}>
                {healthScore}
              </span>
            </div>

            {/* Conectividad (frescura de señal) */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">Conectividad</span>
              <span className={`text-sm font-medium ${
                freshness === "ACTIVO" ? "text-green-600 dark:text-green-400"
                : freshness === "REZAGADO" ? "text-yellow-600 dark:text-yellow-400"
                : "text-gray-400"}`}>
                {freshness === "ACTIVO" ? "Online" : freshness === "REZAGADO" ? "Rezagado" : "Sin señal"}
              </span>
            </div>

            {/* Client */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.transportist", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.transportist}
              </span>
            </div>

            {/* Km totales */}
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {tr("vehicleGrid.kmTraveled", dict)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {vehicle.kmTraveled.toLocaleString()} km
              </span>
            </div>

            {/* Last signal — clickable when lat/lng are available. */}
            {vehicle.lastSignal && (
              <div className="shrink-0">
                {vehicle.latitude !== undefined &&
                vehicle.longitude !== undefined ? (
                  <LastSignalMapPopover
                    latitude={vehicle.latitude}
                    longitude={vehicle.longitude}
                    dict={dict}
                  >
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("vehicleGrid.lastSignal", dict)}
                    </span>
                    <span className="text-sm font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      {formatDateString(vehicle.lastSignal)}
                    </span>
                  </LastSignalMapPopover>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("vehicleGrid.lastSignal", dict)}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDateString(vehicle.lastSignal)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: acciones rápidas + navegación */}
        <div className="flex items-center gap-3 shrink-0">
          <AccionesRapidas tipo="TRUCK" gxcId={vehicle.plate} lang="es" />
          <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={onPrevious}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("vehicleDetail.previous", dict)}
          >
            <HiOutlineChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={onNext}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={tr("vehicleDetail.next", dict)}
          >
            <HiOutlineChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
