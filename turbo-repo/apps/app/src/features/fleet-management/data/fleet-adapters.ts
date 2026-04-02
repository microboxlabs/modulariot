import type { Truck } from "@microboxlabs/miot-resource-client";
import type { Vehicle, VehicleStatus } from "../types/fleet.types";

function statusToVehicleStatus(status: string, active: boolean): VehicleStatus {
  if (!active) return "inactive";
  const s = status.toUpperCase();
  if (s === "MAINTENANCE" || s === "IN_MAINTENANCE") return "maintenance";
  if (s === "ALERT" || s === "WARNING" || s === "ALERTA") return "alert";
  return "active";
}

export function truckToVehicle(truck: Truck): Vehicle {
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
    fuelLevel: 0,
    nextMaintenance: "—",
    kmTraveled: 0,
  };
}
