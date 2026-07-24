"use client";

// SuperProfile F2 — la salud del vehículo deja de ser un acordeón apilado
// bajo el expediente y pasa a vivir EN la grilla bento (doc rector: una
// sola experiencia, jerarquía P1 KPIs → P2 operación/salud → P3 historia).
// Reutiliza tal cual los hooks y secciones existentes del acordeón.
import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useFleetTruckMaintenance } from "../../hooks/use-fleet-truck-maintenance";
import { useFleetTruckTelemetry } from "../../hooks/use-fleet-truck-telemetry";
import { useFleetTruckEvents } from "../../hooks/use-fleet-truck-events";
import { useFleetTruckUsage } from "../../hooks/use-fleet-truck-usage";
import {
  getMaintenanceSectionStatus,
  getTelemetrySectionStatus,
  getTechnicalHealthStatus,
  getEventsSectionStatus,
  getUsageSectionStatus,
  getOverallHealthScore,
  type SectionStatuses,
} from "./vehicle-detail-accordion";
import {
  MaintenanceSection,
  TechnicalHealthSection,
  EventsSection,
  UsageSection,
} from "./sections";
import ExpandableSection from "./expandable-section";
import { HiOutlineSignal } from "react-icons/hi2";
import { FuentesDatos } from "./panel-fuentes";

/** Estados de sección + score, con los mismos fallbacks del acordeón. */
export function useSaludVehiculo(plate: string) {
  const { maintenance, error: mErr } = useFleetTruckMaintenance(plate);
  const { telemetry, error: tErr } = useFleetTruckTelemetry(plate);
  const { eventsDetail, error: eErr } = useFleetTruckEvents(plate);
  const { usage, error: uErr } = useFleetTruckUsage(plate);

  const statuses: SectionStatuses = {
    maintenance: mErr ? "critical"
      : maintenance ? getMaintenanceSectionStatus(maintenance.status.criticality) : "ok",
    technicalHealth: getTechnicalHealthStatus(),
    telemetry: tErr ? "critical"
      : telemetry ? getTelemetrySectionStatus(telemetry.signal.freshness, telemetry.gps.health) : "ok",
    events: eErr ? "critical"
      : eventsDetail ? getEventsSectionStatus(eventsDetail.events) : "ok",
    usage: uErr ? "critical"
      : usage ? getUsageSectionStatus(usage.contract.status, usage.contract.pct_consumed) : "ok",
  };
  return { statuses, healthScore: getOverallHealthScore(statuses), telemetry };
}

function FuentesBadge({ plate }: { plate: string }) {
  const { telemetry } = useFleetTruckTelemetry(plate);
  const gpsOn = telemetry ? telemetry.signal.freshness !== "SIN_SENAL" : false;
  const canOn = !!telemetry && Object.keys(telemetry.capabilities).length > 0;
  const online = (gpsOn ? 1 : 0) + (canOn ? 1 : 0);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      online ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
             : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
      {online}/2 online
    </span>
  );
}

/** Secciones de salud como paneles del bento (P2 del SuperProfile). */
export function PanelesSaludVehiculo({ vehicle, dict }: {
  vehicle: Vehicle; dict: I18nRecord;
}) {
  const { statuses } = useSaludVehiculo(vehicle.plate);
  return (
    <>
      {/* F3: la telemetría se cuenta POR FUENTE (doc rector §8) —
          reemplaza a la sección "Dispositivos y Telemetría" para no duplicar.
          Empareja con Ubicación (ambas son el "ahora" del activo). */}
      <div className="xl:col-span-6 min-w-0">
        <ExpandableSection icon={HiOutlineSignal} title="Fuentes de datos"
          description="Qué entrega datos del activo, con qué frescura y calidad"
          status={statuses.telemetry} defaultExpanded
          badge={<FuentesBadge plate={vehicle.plate} />}>
          <FuentesDatos plate={vehicle.plate} />
        </ExpandableSection>
      </div>
      <div className="xl:col-span-6 min-w-0"><MaintenanceSection vehicle={vehicle} dict={dict} /></div>
      <div className="xl:col-span-6 min-w-0"><TechnicalHealthSection dict={dict} status={statuses.technicalHealth} /></div>
      <div className="xl:col-span-6 min-w-0"><UsageSection vehicle={vehicle} dict={dict} /></div>
      <div className="xl:col-span-12 min-w-0"><EventsSection vehicle={vehicle} dict={dict} /></div>
    </>
  );
}
