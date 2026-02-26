import { type IconType } from "react-icons";

export type VehicleStatus = "active" | "maintenance" | "alert" | "inactive";

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: string;
  status: VehicleStatus;
  driver: string;
  lastLocation: string;
  fuelLevel: number;
  nextMaintenance: string;
  kmTraveled: number;
}

export interface FleetKpi {
  id: string;
  labelKey: string;
  value: number;
  icon: IconType;
  color: string;
  darkColor: string;
}

export interface SpecialView {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: IconType;
  color: string;
  darkColor: string;
  value: string;
}
