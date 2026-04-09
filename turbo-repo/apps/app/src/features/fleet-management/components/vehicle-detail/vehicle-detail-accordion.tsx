"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { MaintenanceCriticality } from "../../types/truck-maintenance.types";
import type {
  GpsHealth,
  SignalFreshness,
} from "../../types/truck-telemetry.types";
import type { TruckEventItem } from "../../types/truck-events.types";
import { useFleetTruckMaintenance } from "../../hooks/use-fleet-truck-maintenance";
import { useFleetTruckTelemetry } from "../../hooks/use-fleet-truck-telemetry";
import { useFleetTruckEvents } from "../../hooks/use-fleet-truck-events";
import {
  HealthSection,
  MaintenanceSection,
  TechnicalHealthSection,
  TelemetrySection,
  EventsSection,
  UsageSection,
} from "./sections";

interface VehicleDetailAccordionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

export type SectionStatus = "ok" | "warning" | "critical";

export interface VehicleDetailData {
  general: {
    health: number;
  };
  usage: {
    totalKilometers: number;
    monthlyContractualConsumptionPercentage: number;
    kmTravelledThisMonth: number;
    remainingKmThisMonth: number;
    averageDaily: number;
    operationHours: number;
    activeDays: number;
    annualTotalKm: number;
    intensityLast30Days: number[];
  };
}

// Status calculation helpers

/**
 * Map a maintenance criticality bucket to the accordion's three-state
 * section status. Shared with MaintenanceSection so the accordion health
 * overview and the section header always agree.
 */
export function getMaintenanceSectionStatus(
  criticality: MaintenanceCriticality
): SectionStatus {
  switch (criticality) {
    case "CRITICO":
    case "VENCIDO":
      return "critical";
    case "POR_VENCER":
    case "EN_TALLER":
      return "warning";
    case "AL_DIA":
    case "AGENDADO":
    case "SIN_INFO":
      return "ok";
  }
}

/**
 * Collapse the `(frescura × salud_gps)` cross product from
 * `fn_dx_senal_detalle` into the accordion's three-state section status.
 * Shared with TelemetrySection so the header badge and the overall
 * health overview always agree.
 *
 * SIN_SENAL is intentionally `ok` (baseline): ~89% of the fleet is in
 * that bucket today, and treating it as warning or critical would paint
 * the dashboard red on a data-availability gap, not a vehicle problem.
 */
export function getTelemetrySectionStatus(
  freshness: SignalFreshness,
  health: GpsHealth
): SectionStatus {
  if (freshness === "SIN_SENAL") return "ok";
  if (freshness === "REZAGADO" || health === "DEGRADADO") return "warning";
  return "ok";
}

/**
 * Placeholder until the technical-health backend wiring lands. The
 * section currently renders a hardcoded happy-path UI, so the overall
 * health overview should agree and treat it as ok.
 */
export function getTechnicalHealthStatus(): SectionStatus {
  return "ok";
}

/**
 * Derive section status from the DTO events list. Severity mapping:
 *   Crítico/Alto (icu 3–4) → critical
 *   Medio (icu 2)          → warning
 *   Bajo (icu 1)           → info (ok)
 * Shared with EventsSection via import.
 */
export function getEventsSectionStatus(
  events: TruckEventItem[]
): SectionStatus {
  const hasCritical = events.some((e) => e.icu_code >= 3);
  const hasWarning = events.some((e) => e.icu_code === 2);
  if (hasCritical) return "critical";
  if (hasWarning) return "warning";
  return "ok";
}

export function getUsageStatus(data: VehicleDetailData): SectionStatus {
  if (data.usage.monthlyContractualConsumptionPercentage > 100) return "critical";
  if (data.usage.monthlyContractualConsumptionPercentage > 90) return "warning";
  return "ok";
}

export interface SectionStatuses {
  maintenance: SectionStatus;
  technicalHealth: SectionStatus;
  telemetry: SectionStatus;
  events: SectionStatus;
  usage: SectionStatus;
}

/**
 * Computes statuses for the mock-backed sections only. The maintenance
 * and telemetry statuses come from async hooks and are merged in at the
 * component level — keeping this function pure so the other sections
 * stay testable.
 */
export function getMockSectionStatuses(
  data: VehicleDetailData
): Omit<SectionStatuses, "maintenance" | "telemetry" | "events"> {
  return {
    technicalHealth: getTechnicalHealthStatus(),
    usage: getUsageStatus(data),
  };
}

export function getOverallHealthScore(_statuses: SectionStatuses): number {
  // Placeholder until the 1000–9999 scoring model is wired up.
  return 6789;
}

const vehicleData = {
  general: {
    health: 50,
  },
  usage: {
    totalKilometers: 47400,
    monthlyContractualConsumptionPercentage: 75,
    kmTravelledThisMonth: 11700,
    remainingKmThisMonth: 3300,
    averageDaily: 390,
    operationHours: 153,
    activeDays: 25,
    annualTotalKm: 140000,
    intensityLast30Days: [320, 450, 380, 520, 410, 280, 390, 120, 12, 156, 600, 480, 350, 400, 420, 500, 300, 200, 450, 480, 520, 410, 280, 390, 120,12, 156, 600, 610, 510],
  }
}

export default function VehicleDetailAccordion({
  vehicle,
  dict,
}: VehicleDetailAccordionProps) {
  // MaintenanceSection and TelemetrySection both subscribe to the same SWR
  // keys below, so these extra calls here dedup to a single network fetch
  // each. While loading or on 404/error we fall back to "ok" so the
  // health overview doesn't flicker or go red on transient states.
  const { maintenance } = useFleetTruckMaintenance(vehicle.plate);
  const { telemetry } = useFleetTruckTelemetry(vehicle.plate);
  const { eventsDetail } = useFleetTruckEvents(vehicle.plate);

  const maintenanceStatus: SectionStatus = maintenance
    ? getMaintenanceSectionStatus(maintenance.status.criticality)
    : "ok";
  const telemetryStatus: SectionStatus = telemetry
    ? getTelemetrySectionStatus(
        telemetry.signal.freshness,
        telemetry.gps.health
      )
    : "ok";
  const eventsStatus: SectionStatus = eventsDetail
    ? getEventsSectionStatus(eventsDetail.events)
    : "ok";

  const statuses: SectionStatuses = {
    ...getMockSectionStatuses(vehicleData),
    maintenance: maintenanceStatus,
    telemetry: telemetryStatus,
    events: eventsStatus,
  };
  const healthScore = getOverallHealthScore(statuses);

  return (
    <div className="flex flex-col gap-3 py-4 overflow-y-auto">
      <HealthSection dict={dict} healthScore={healthScore} statuses={statuses} />
      <MaintenanceSection vehicle={vehicle} dict={dict} />
      <TechnicalHealthSection dict={dict} status={statuses.technicalHealth} />
      <TelemetrySection vehicle={vehicle} dict={dict} />
      <EventsSection vehicle={vehicle} dict={dict} />
      <UsageSection dict={dict} data={vehicleData} status={statuses.usage} />
    </div>
  );
}
