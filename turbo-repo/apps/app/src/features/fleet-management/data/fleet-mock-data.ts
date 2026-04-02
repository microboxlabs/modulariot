import {
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineWrenchScrewdriver,
  HiOutlineExclamationTriangle,
  HiOutlineNoSymbol,
  HiOutlineArrowPath,
  HiOutlineDocumentText,
  HiOutlineCog6Tooth,
  HiOutlineShieldCheck,
  HiOutlineCpuChip,
} from "react-icons/hi2";
import type {
  Vehicle,
  FleetKpi,
  SpecialView,
} from "../types/fleet.types";

export const fleetKpis: FleetKpi[] = [
  {
    id: "total",
    labelKey: "totalFleet",
    value: 124,
    icon: HiOutlineTruck,
    color: "text-blue-600 bg-blue-100",
    darkColor: "dark:text-blue-400 dark:bg-blue-900/30",
  },
  {
    id: "active",
    labelKey: "active",
    value: 98,
    icon: HiOutlineCheckCircle,
    color: "text-green-600 bg-green-100",
    darkColor: "dark:text-green-400 dark:bg-green-900/30",
  },
  {
    id: "maintenance",
    labelKey: "inMaintenance",
    value: 12,
    icon: HiOutlineWrenchScrewdriver,
    color: "text-yellow-600 bg-yellow-100",
    darkColor: "dark:text-yellow-400 dark:bg-yellow-900/30",
  },
  {
    id: "alerts",
    labelKey: "alerts",
    value: 8,
    icon: HiOutlineExclamationTriangle,
    color: "text-red-600 bg-red-100",
    darkColor: "dark:text-red-400 dark:bg-red-900/30",
  },
  {
    id: "inactive",
    labelKey: "inactive",
    value: 6,
    icon: HiOutlineNoSymbol,
    color: "text-gray-600 bg-gray-100",
    darkColor: "dark:text-gray-400 dark:bg-gray-700/30",
  },
];

export const specialViews: SpecialView[] = [
  {
    id: "maintenance-status",
    titleKey: "maintenanceStatusView",
    descriptionKey: "maintenanceStatusViewDesc",
    icon: HiOutlineCog6Tooth,
    iconColor: "text-blue-600 bg-blue-100",
    iconDarkColor: "dark:text-blue-400 dark:bg-blue-900/30",
    route: "home/maintenanceStatus",
  },
  {
    id: "technical-health",
    titleKey: "technicalHealthView",
    descriptionKey: "technicalHealthViewDesc",
    icon: HiOutlineShieldCheck,
    iconColor: "text-green-600 bg-green-100",
    iconDarkColor: "dark:text-green-400 dark:bg-green-900/30",
    route: "home/vehicleTechnicalHealth",
  },
  {
    id: "devices-telemetry",
    titleKey: "devicesTelemetryView",
    descriptionKey: "devicesTelemetryViewDesc",
    icon: HiOutlineCpuChip,
    iconColor: "text-purple-600 bg-purple-100",
    iconDarkColor: "dark:text-purple-400 dark:bg-purple-900/30",
    route: "home/devicesAndTelemetry",
  },
  {
    id: "events",
    titleKey: "eventsView",
    descriptionKey: "eventsViewDesc",
    icon: HiOutlineExclamationTriangle,
    iconColor: "text-amber-600 bg-amber-100",
    iconDarkColor: "dark:text-amber-400 dark:bg-amber-900/30",
    route: "home/operativeEvents",
  },
  {
    id: "usage",
    titleKey: "usageView",
    descriptionKey: "usageViewDesc",
    icon: HiOutlineArrowPath,
    iconColor: "text-teal-600 bg-teal-100",
    iconDarkColor: "dark:text-teal-400 dark:bg-teal-900/30",
    route: "home/fleetUsage",
  },
  {
    id: "general-info",
    titleKey: "generalInfoView",
    descriptionKey: "generalInfoViewDesc",
    icon: HiOutlineDocumentText,
    iconColor: "text-gray-600 bg-gray-100",
    iconDarkColor: "dark:text-gray-400 dark:bg-gray-700/30",
    route: "home/generalInfo",
  },
];

export const vehicles: Vehicle[] = [
  
];
