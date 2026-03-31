import { type IconType } from "react-icons";

export type VehicleStatus = "active" | "maintenance" | "alert" | "inactive";

export type AchievementId =
  | "road_warrior"
  | "eco_champion"
  | "perfect_maintenance"
  | "speed_demon"
  | "early_bird"
  | "night_owl"
  | "long_hauler"
  | "city_navigator";

export interface Achievement {
  id: AchievementId;
  unlockedAt?: string;
}

export interface DriverStats {
  rating: number; // 1-5 stars
  tripsCompleted: number;
  onTimeDeliveryRate: number; // percentage
  safetyScore: number; // 0-100
}

export interface VehicleGamification {
  healthScore: number; // 0-100
  level: number;
  xp: number;
  xpToNextLevel: number;
  achievements: Achievement[];
  streakDays: number; // days without incidents
  weeklyKmGoal: number;
  weeklyKmProgress: number;
  driverStats: DriverStats;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: string;
  status: VehicleStatus;
  driver: string;
  lastLocation: string;
  brand: string;
  transportist: string;
  fuelLevel: number;
  nextMaintenance: string;
  kmTraveled: number;
  lastSignal?: string;
  gamification?: VehicleGamification;
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
  iconColor: string;
  iconDarkColor: string;
  route: string;
}
