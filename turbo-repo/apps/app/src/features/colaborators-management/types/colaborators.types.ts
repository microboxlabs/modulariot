import { type IconType } from "react-icons";

export interface ColaboratorKpi {
  id: string;
  labelKey: string;
  value: string | number;
  icon: IconType;
  color: string;
  darkColor: string;
}

export type ColaboratorRank =
  | "conductor-senior"
  | "conductor-especializado"
  | "conductor"
  | "operador-logistico";

export type ColaboratorEmploymentStatus =
  | "activo"
  | "suspendido"
  | "vacaciones";

export type ColaboratorPerformanceStatus =
  | "excelente"
  | "bueno"
  | "en-observacion";

export type ColaboratorAchievement =
  | "mejora-sostenida"
  | "puntualidad-excepcional";

export type ColaboratorAlert = "conducta-critica-reciente";

export interface Colaborator {
  id: string;
  name: string;
  email: string;
  rank: ColaboratorRank;
  department: string;
  score: number; // 0-100 percentage for performance indicator
  employmentStatus: ColaboratorEmploymentStatus;
  punctuality: number; // percentage
  safety: number; // percentage
  incidentsCount: number;
  avatar?: string;
  assignedVehiclePlate?: string; // License plate if using a vehicle
  achievements?: ColaboratorAchievement[];
  alerts?: ColaboratorAlert[];
}

export type ColaboratorStatus =
  | "active"
  | "at-risk"
  | "outstanding"
  | "inactive";

export function getPerformanceStatus(
  score: number
): ColaboratorPerformanceStatus {
  if (score >= 80) return "excelente";
  if (score >= 50) return "bueno";
  return "en-observacion";
}

// ─── Colaborator Detail / Expedient types ────────────────────────────

export type EventUrgency = "critical" | "warning" | "info";
export type BehaviorCategory = "seguridad" | "uso" | "normativo";
export type FilterType =
  | "todos"
  | "seguridad"
  | "uso"
  | "normativo"
  | "criticos";

export interface BehaviorEvent {
  title: string;
  licensePlate: string;
  route: string;
  location: string;
  date: string;
  urgency: EventUrgency;
  category: BehaviorCategory;
}

/** One month of evolution data (dynamic — comes from backend) */
export interface MonthlyDataPoint {
  score: number;
  safety: number;
  punctuality: number;
  incidents: number;
}

export type ScoreCardIconId =
  | "shield"
  | "clock"
  | "bolt"
  | "document"
  | "truck"
  | "pulse";

/** Dynamic score for a single KPI card (comes from backend) */
export interface ScoreCardValue {
  id: FilterType;
  score: number;
}

/** Full detail/expedient data for one colaborator (dynamic — backend payload) */
export interface ColaboratorDetailData {
  colaboratorId: string;
  scores: ScoreCardValue[];
  monthlyEvolution: MonthlyDataPoint[];
  behaviorEvents: BehaviorEvent[];
}
