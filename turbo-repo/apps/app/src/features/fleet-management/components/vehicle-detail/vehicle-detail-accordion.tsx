"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type {
  MaintenanceCriticality,
  TruckMaintenanceDetail,
} from "../../types/truck-maintenance.types";
import type {
  GpsHealth,
  SignalFreshness,
  TruckTelemetryDetail,
} from "../../types/truck-telemetry.types";
import type {
  TruckEventItem,
  TruckEventsDetail,
} from "../../types/truck-events.types";
import type {
  ContractDeviation,
  TruckUsageDetail,
} from "../../types/truck-usage.types";
import { useFleetTruckMaintenance } from "../../hooks/use-fleet-truck-maintenance";
import { useFleetTruckTelemetry } from "../../hooks/use-fleet-truck-telemetry";
import { useFleetTruckEvents } from "../../hooks/use-fleet-truck-events";
import { useFleetTruckUsage } from "../../hooks/use-fleet-truck-usage";
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

/**
 * Collapse the `(contract.status × contract.pct_consumed)` signal from
 * the usage DTO into the accordion's three-state section status. Shared
 * with UsageSection so the header badge and the overall health overview
 * always agree.
 *
 * `contract.status` is derived client-side after the 18→11 column
 * shrink (see `deriveContractStatus` in `pgrest-client.ts`).
 *
 * Only `SOBREUSO` is treated as critical — `SUBUTILIZADO` is the majority
 * case (~76% of the fleet) and `SIN_DATOS` is a no-signal baseline. The
 * `NORMAL` bucket escalates to `warning` once consumption passes 90%
 * (mirrors the telemetry pattern of flagging near-limit cases).
 */
export function getUsageSectionStatus(
  deviation: ContractDeviation,
  pctConsumed: number | null
): SectionStatus {
  if (deviation === "SOBREUSO") return "critical";
  if (deviation === "NORMAL" && pctConsumed !== null && pctConsumed > 90)
    return "warning";
  return "ok";
}

export interface SectionStatuses {
  maintenance: SectionStatus;
  technicalHealth: SectionStatus;
  telemetry: SectionStatus;
  events: SectionStatus;
  usage: SectionStatus;
}

// --- Section status resolvers (avoid nested ternaries). ---

function resolveMaintenanceStatus(
  error: Error | undefined,
  data: TruckMaintenanceDetail | null
): SectionStatus {
  if (error) return "critical";
  if (data) return getMaintenanceSectionStatus(data.status.criticality);
  return "ok";
}

function resolveTelemetryStatus(
  error: Error | undefined,
  data: TruckTelemetryDetail | null
): SectionStatus {
  if (error) return "critical";
  if (data)
    return getTelemetrySectionStatus(data.signal.freshness, data.gps.health);
  return "ok";
}

function resolveEventsStatus(
  error: Error | undefined,
  data: TruckEventsDetail | null
): SectionStatus {
  if (error) return "critical";
  if (data) return getEventsSectionStatus(data.events);
  return "ok";
}

function resolveUsageStatus(
  error: Error | undefined,
  data: TruckUsageDetail | null
): SectionStatus {
  if (error) return "critical";
  if (data)
    return getUsageSectionStatus(
      data.contract.status,
      data.contract.pct_consumed
    );
  return "ok";
}

/**
 * Computes statuses for the mock-backed sections only. The maintenance,
 * telemetry, events, and usage statuses come from async hooks and are
 * merged in at the component level — keeping this function pure so the
 * remaining section stays testable.
 */
export function getMockSectionStatuses(): Pick<
  SectionStatuses,
  "technicalHealth"
> {
  return {
    technicalHealth: getTechnicalHealthStatus(),
  };
}

export function getOverallHealthScore(_statuses: SectionStatuses): number {
  // Placeholder until the 1000–9999 scoring model is wired up.
  return 1000;
}

export default function VehicleDetailAccordion({
  vehicle,
  dict,
}: VehicleDetailAccordionProps) {
  // Each child section subscribes to the same SWR keys below, so these
  // extra calls here dedup to a single network fetch each. While loading
  // or on 404/error we fall back to "ok" so the health overview doesn't
  // flicker or go red on transient states.
  const { maintenance, error: maintenanceError } = useFleetTruckMaintenance(
    vehicle.plate
  );
  const { telemetry, error: telemetryError } = useFleetTruckTelemetry(
    vehicle.plate
  );
  const { eventsDetail, error: eventsError } = useFleetTruckEvents(
    vehicle.plate
  );
  const { usage, error: usageError } = useFleetTruckUsage(vehicle.plate);

  const maintenanceStatus: SectionStatus = resolveMaintenanceStatus(
    maintenanceError,
    maintenance
  );
  const telemetryStatus: SectionStatus = resolveTelemetryStatus(
    telemetryError,
    telemetry
  );
  const eventsStatus: SectionStatus = resolveEventsStatus(
    eventsError,
    eventsDetail
  );
  const usageStatus: SectionStatus = resolveUsageStatus(usageError, usage);

  const statuses: SectionStatuses = {
    ...getMockSectionStatuses(),
    maintenance: maintenanceStatus,
    telemetry: telemetryStatus,
    events: eventsStatus,
    usage: usageStatus,
  };
  const healthScore = getOverallHealthScore(statuses);

  return (
    <div className="flex flex-col gap-3 py-4 w-full max-w-6xl">
      <HealthSection
        dict={dict}
        healthScore={healthScore}
        statuses={statuses}
      />
      <MaintenanceSection vehicle={vehicle} dict={dict} />
      <TechnicalHealthSection dict={dict} status={statuses.technicalHealth} />
      <TelemetrySection vehicle={vehicle} dict={dict} />
      <EventsSection vehicle={vehicle} dict={dict} />
      <UsageSection vehicle={vehicle} dict={dict} />
    </div>
  );
}
