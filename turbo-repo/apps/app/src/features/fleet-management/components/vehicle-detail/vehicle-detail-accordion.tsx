"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { MaintenanceCriticality } from "../../types/truck-maintenance.types";
import { useFleetTruckMaintenance } from "../../hooks/use-fleet-truck-maintenance";
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
  technicalHealth: {
    alerts: Array<{
      title: string;
      description: string;
      type: "critical" | "warning";
    }>;
    activeFailures: number;
    resolved: number;
    responseTimeHour: number;
  };
  telemetry: {
    odometer: number;
    dateLastUpdate: string;
    status: string;
    engineRunning: boolean;
    speed: number;
    rpm: number;
    batteryPercentage: number;
    engineTempC: number;
    location: string;
    locationCoords: { lat: number, lng: number },
    transmissionIntervalSecs: number;
    installedDevices: Array<{
      name: string;
      description: string;
      icon: "location" | "odometer" | "live";
    }>;
    accumulatedUptimePercentage: number;
    dataProcessedToday: number;
    signalLost30d: number;
  };
  events: Array<{
    title: string;
    description: string;
    urgency: "critical" | "warning" | "info";
    direction: string;
    date: string;
    category: "evento" | "mantencion";
  }>;
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

export function getTechnicalHealthStatus(data: VehicleDetailData): SectionStatus {
  const hasCriticalAlert = data.technicalHealth.alerts.some(alert => alert.type === "critical");
  if (hasCriticalAlert || data.technicalHealth.activeFailures > 2) return "critical";
  if (data.technicalHealth.alerts.length > 0 || data.technicalHealth.activeFailures > 0) return "warning";
  return "ok";
}

export function getTelemetryStatus(data: VehicleDetailData): SectionStatus {
  if (data.telemetry.batteryPercentage < 20 || data.telemetry.signalLost30d > 5) return "critical";
  if (data.telemetry.batteryPercentage < 40 || data.telemetry.signalLost30d > 2) return "warning";
  return "ok";
}

export function getEventsStatus(data: VehicleDetailData): SectionStatus {
  const hasCriticalEvent = data.events.some(event => event.urgency === "critical");
  const hasWarningEvent = data.events.some(event => event.urgency === "warning");
  if (hasCriticalEvent) return "critical";
  if (hasWarningEvent) return "warning";
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
 * status comes from the async hook and is merged in at the component level
 * — keeping this function pure so the other sections stay testable.
 */
export function getMockSectionStatuses(
  data: VehicleDetailData
): Omit<SectionStatuses, "maintenance"> {
  return {
    technicalHealth: getTechnicalHealthStatus(data),
    telemetry: getTelemetryStatus(data),
    events: getEventsStatus(data),
    usage: getUsageStatus(data),
  };
}

export function getOverallHealthScore(statuses: SectionStatuses): number {
  const statusValues = Object.values(statuses);
  const criticalCount = statusValues.filter(s => s === "critical").length;
  const warningCount = statusValues.filter(s => s === "warning").length;
  
  // Base score of 100, subtract for issues
  let score = 100;
  score -= criticalCount * 20;
  score -= warningCount * 10;
  
  return Math.max(0, Math.min(100, score));
}

const vehicleData = {
  general: {
    health: 50,
  },
  technicalHealth: {
    "alerts": [
      {
        title: "Falla DPF - Saturación crítica",
        description: "Sistema de filtro de partículas diésel requiere regeneración urgente (Detectada: 10 Feb 2026 14:45)",
        type: "critical"
      } as const,
      {
        title: "Falla sensor presión neumáticos",
        description: "TPMS reporta error en sensor rueda delantera derecha (Detectada: 22 Ene 2026 16:30)",
        type: "warning"
      } as const
    ],
    "activeFailures": 3,
    "resolved": 5,
    "responseTimeHour": 18
  },
  telemetry: {
    odometer: 47000,
    dateLastUpdate: "2026-02-10T14:45:00Z",
    status: "On Route",
    engineRunning: true,
    speed: 65,
    rpm: 3000,
    batteryPercentage: 80,
    engineTempC: 90,
    location: "Av Kennedy 5000, Las Condes",
    locationCoords: { lat: -33.393, lng: -70.567 },
    transmissionIntervalSecs: 30,
    installedDevices: [
      {
        name: "GPS Tracker",
        description: "S/N: GT-2341-A8F2",
        icon: "location"
      } as const,
      {
        name: "Sensor OBD-II",
        description: "Diagnóstico motor",
        icon: "odometer"
      } as const,
      {
        name: "Acelerómetro 3-Ejes",
        description: "Detección de eventos",
        icon: "live"
      } as const,
    ],
    accumulatedUptimePercentage: 99.7,
    dataProcessedToday: 708,
    signalLost30d: 1,
  },
  events: [
    {
      title: "Frenado brusco detectado",
      description: "Sistema de telemetría detectó evento de frenado brusco superior a 8G",
      urgency: "warning",
      direction: "Av. Kennedy 5000, Las Condes",
      date: "10 Feb 2026 14:45",
      category: "evento",
    } as const,
    {
      title: "Exceso de velocidad",
      description: "Velocidad máxima de 120 km/h superada en zona de 80 km/h",
      urgency: "critical",
      direction: "Ruta 5 Sur, Km 45",
      date: "10 Feb 2026 12:30",
      category: "evento",
    } as const,
    {
      title: "Mantención programada completada",
      description: "Cambio de aceite y filtros realizado según pauta de 10.000 km",
      urgency: "info",
      direction: "Taller Central, Santiago",
      date: "08 Feb 2026 09:00",
      category: "mantencion",
    } as const,
  ],
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
  // MaintenanceSection subscribes to the same SWR key, so this extra call
  // here dedups to a single network fetch. While loading or on 404/error
  // we fall back to "ok" so the health overview doesn't flicker or go red
  // on transient states.
  const { maintenance } = useFleetTruckMaintenance(vehicle.plate);
  const maintenanceStatus: SectionStatus = maintenance
    ? getMaintenanceSectionStatus(maintenance.status.criticality)
    : "ok";

  const statuses: SectionStatuses = {
    ...getMockSectionStatuses(vehicleData),
    maintenance: maintenanceStatus,
  };
  const healthScore = getOverallHealthScore(statuses);

  return (
    <div className="flex flex-col gap-3 py-4 overflow-y-auto">
      <HealthSection dict={dict} healthScore={healthScore} statuses={statuses} />
      <MaintenanceSection vehicle={vehicle} dict={dict} />
      <TechnicalHealthSection dict={dict} data={vehicleData} status={statuses.technicalHealth} />
      <TelemetrySection dict={dict} data={vehicleData} status={statuses.telemetry} />
      <EventsSection dict={dict} data={vehicleData} status={statuses.events} />
      <UsageSection dict={dict} data={vehicleData} status={statuses.usage} />
    </div>
  );
}
