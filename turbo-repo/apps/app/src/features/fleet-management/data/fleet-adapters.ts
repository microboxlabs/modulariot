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

function formatLastLocation(truck: Truck): string {
  // Prefer a human-readable label (e.g. "SANTIAGO" from pgrest `ubicacion`)
  // over raw coordinates when the upstream source provides one.
  const label = metricString(truck, "location_label");
  if (label && label.trim() !== "") return label;
  const latitude = metricNumber(truck, "latitude");
  const longitude = metricNumber(truck, "longitude");
  if (latitude === undefined || longitude === undefined) return "—";
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/**
 * When both current odometer and maintenance interval are known, format the
 * remaining kilometres until the next scheduled service. Falls back to "—"
 * when either metric is absent.
 */
function formatNextMaintenance(truck: Truck): string {
  const odometerKm = metricNumber(truck, "odometer_km");
  const frequencyKm = metricNumber(truck, "maintenance_frequency_km");
  if (odometerKm === undefined || frequencyKm === undefined || frequencyKm <= 0) {
    return "—";
  }
  const remainder = odometerKm % frequencyKm;
  const remainingKm = remainder === 0 ? frequencyKm : frequencyKm - remainder;
  return `${remainingKm.toLocaleString()} km`;
}

export function truckToVehicle(truck: Truck): Vehicle {
  const fuelLevel = metricNumber(truck, "fuel_level_pct") ?? 0;
  const fuelVolumeMl = metricNumber(truck, "fuel_volume_ml");
  const fuelVolumeLiters = fuelVolumeMl === undefined ? undefined : fuelVolumeMl / 1000;
  const kmTraveled = metricNumber(truck, "odometer_km") ?? 0;
  const lastSignal = metricString(truck, "timestamp");
  const transportist = metricString(truck, "customer_account") ?? "—";
  const latitude = metricNumber(truck, "latitude");
  const longitude = metricNumber(truck, "longitude");

  return {
    id: String(truck.id),
    plate: truck.licensePlate ?? truck.externalId ?? String(truck.id),
    model: [truck.brand, truck.model].filter(Boolean).join(" ") || "—",
    type: truck.truckType ?? "—",
    status: statusToVehicleStatus(truck.status ?? "", truck.active ?? true),
    brand: truck.brand ?? "—",
    driver: "—",
    lastLocation: formatLastLocation(truck),
    transportist,
    fuelLevel,
    fuelVolumeLiters,
    nextMaintenance: formatNextMaintenance(truck),
    kmTraveled,
    lastSignal,
    latitude,
    longitude,
    assetId: truck.assetId,
  };
}
