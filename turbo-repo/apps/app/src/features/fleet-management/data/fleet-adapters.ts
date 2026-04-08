import type { Truck } from "@microboxlabs/miot-resource-client";
import type { Vehicle, VehicleStatus } from "../types/fleet.types";

function statusToVehicleStatus(status: string, active: boolean): VehicleStatus {
  if (!active) return "inactive";
  const s = status.toUpperCase();
  if (s === "MAINTENANCE" || s === "IN_MAINTENANCE") return "maintenance";
  if (s === "ALERT" || s === "WARNING" || s === "ALERTA") return "alert";
  return "active";
}

function metricNumber(truck: Truck, key: string): number | undefined {
  const value = truck.latestMetrics?.[key];
  return typeof value === "number" ? value : undefined;
}

function metricString(truck: Truck, key: string): string | undefined {
  const value = truck.latestMetrics?.[key];
  return typeof value === "string" ? value : undefined;
}

export function truckToVehicle(truck: Truck): Vehicle {
  const fuelLevel = metricNumber(truck, "fuel_level_pct") ?? 0;
  const kmTraveled = metricNumber(truck, "odometer_km") ?? 0;
  const lastSignal = metricString(truck, "timestamp");

  return {
    id: String(truck.id),
    plate: truck.licensePlate ?? truck.externalId ?? String(truck.id),
    model: [truck.brand, truck.model].filter(Boolean).join(" ") || "—",
    type: truck.truckType ?? "—",
    status: statusToVehicleStatus(truck.status ?? "", truck.active ?? true),
    brand: truck.brand ?? "—",
    driver: "—",
    lastLocation: "—",
    transportist: "—",
    fuelLevel,
    nextMaintenance: "—",
    kmTraveled,
    lastSignal,
    assetId: truck.assetId,
  };
}
