"use client";

import type { Vehicle } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
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

export interface VehicleDetailData {
  general: {
    health: number;
  };
  maintenance: {
    status: "up_to_date" | "due_soon" | "overdue";
    totalKm: number;
    nextMaintenanceKm: number;
    lastManteinanceDate: string;
    contractualFrecuency: number;
    manteinancesCount: number;
    kmSinceManteinance: number;
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

const vehicleData = {
  general: {
    health: 50,
  },
  maintenance: {
    status: "up_to_date" as "up_to_date", // up_to_date | due_soon | overdue
    totalKm: 12450,
    nextMaintenanceKm: 55000,
    lastManteinanceDate: "2026-01-25", 
    contractualFrecuency: 10000,
    manteinancesCount: 5,
    kmSinceManteinance: 2400,
  },
  technicalHealth: {
    "alerts": [
      {
        title: "Falla DPF - Saturación crítica",
        description: "Sistema de filtro de partículas diésel requiere regeneración urgente (Detectada: 10 Feb 2026 14:45)",
        type: "critical" as "critical"
      },
      {
        title: "Falla sensor presión neumáticos",
        description: "TPMS reporta error en sensor rueda delantera derecha (Detectada: 22 Ene 2026 16:30)",
        type: "warning" as "warning"
      }
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
    transmissionIntervalSecs: 30,
    installedDevices: [
      {
        name: "GPS Tracker",
        description: "S/N: GT-2341-A8F2",
        icon: "location" as "location"
      },
      {
        name: "Sensor OBD-II",
        description: "Diagnóstico motor",
        icon: "odometer" as "odometer"
      },
      {
        name: "Acelerómetro 3-Ejes",
        description: "Detección de eventos",
        icon: "live" as "live"
      },
    ],
    accumulatedUptimePercentage: 99.7,
    dataProcessedToday: 708,
    signalLost30d: 1,
  },
  events: [
    {
      title: "Frenado brusco detectado",
      description: "Sistema de telemetría detectó evento de frenado brusco superior a 8G",
      urgency: "warning" as "warning",
      direction: "Av. Kennedy 5000, Las Condes",
      date: "10 Feb 2026 14:45",
      category: "evento" as "evento",
    },
    {
      title: "Exceso de velocidad",
      description: "Velocidad máxima de 120 km/h superada en zona de 80 km/h",
      urgency: "critical" as "critical",
      direction: "Ruta 5 Sur, Km 45",
      date: "10 Feb 2026 12:30",
      category: "evento" as "evento",
    },
    {
      title: "Mantención programada completada",
      description: "Cambio de aceite y filtros realizado según pauta de 10.000 km",
      urgency: "info" as "info",
      direction: "Taller Central, Santiago",
      date: "08 Feb 2026 09:00",
      category: "mantencion" as "mantencion",
    },
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

  return (
    <div className="flex flex-col gap-3">
      <HealthSection vehicle={vehicle} dict={dict} healthScore={20} />
      <MaintenanceSection vehicle={vehicle} dict={dict} data={vehicleData} />
      <TechnicalHealthSection dict={dict} data={vehicleData} />
      <TelemetrySection dict={dict} data={vehicleData} />
      <EventsSection dict={dict} data={vehicleData} />
      <UsageSection dict={dict} data={vehicleData} />
    </div>
  );
}
