import { type IconType } from "react-icons";

export interface CollaboratorKpi {
  id: string;
  labelKey: string;
  value: string | number;
  icon: IconType;
  color: string;
  darkColor: string;
}

export type CollaboratorRank =
  | "conductor-senior"
  | "conductor-especializado"
  | "conductor"
  | "operador-logistico";

export type CollaboratorEmploymentStatus =
  | "activo"
  | "suspendido"
  | "vacaciones";

export type CollaboratorPerformanceStatus =
  | "excelente"
  | "bueno"
  | "en-observacion";

export type CollaboratorAchievement =
  | "mejora-sostenida"
  | "puntualidad-excepcional";

export type CollaboratorAlert = "conducta-critica-reciente";

export interface Collaborator {
  id: string;
  /**
   * Stable external identifier the backend uses to look up the expediente
   * (currently `cod_driver` from `v_modulariot_drivers_tmp`, shaped as
   * `{id}-{patente}`). Surfaced here so the list page can route straight
   * to `/collaborators-management/{externalId}` without a second lookup.
   * Optional because the mock data service doesn't produce it.
   */
  externalId?: string;
  name: string;
  email: string;
  rank: CollaboratorRank;
  department: string;
  score: number; // 0-100 percentage for performance indicator
  employmentStatus: CollaboratorEmploymentStatus;
  punctuality: number; // percentage
  safety: number; // percentage
  incidentsCount: number;
  avatar?: string;
  assignedVehiclePlate?: string; // License plate if using a vehicle
  achievements?: CollaboratorAchievement[];
  alerts?: CollaboratorAlert[];
}

export type CollaboratorStatus =
  | "active"
  | "at-risk"
  | "outstanding"
  | "inactive";

export function getPerformanceStatus(
  score: number
): CollaboratorPerformanceStatus {
  if (score >= 80) return "excelente";
  if (score >= 50) return "bueno";
  return "en-observacion";
}

// ─── Collaborator Detail / Expedient types ────────────────────────────

import type { EventUrgency } from "@/features/common/components/timeline-event";

export type { EventUrgency } from "@/features/common/components/timeline-event";
export type FilterType =
  | "todos"
  | "seguridad"
  | "uso"
  | "normativo"
  | "eficiencia"
  | "criticos";

export interface BehaviorEvent {
  title: string;
  licensePlate: string;
  route: string;
  location: string;
  date: string;
  urgency: EventUrgency;
  category: string;
}

/** One month of evolution data (dynamic — comes from backend) */
export interface MonthlyDataPoint {
  /** ISO month string, e.g. "2025-05" */
  date: string;
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

/** Full detail/expedient data for one collaborator (dynamic — backend payload) */
export interface CollaboratorDetailData {
  collaboratorId: string;
  scores: ScoreCardValue[];
  monthlyEvolution: MonthlyDataPoint[];
  behaviorEvents: BehaviorEvent[];
}

/**
 * Combined detail response shape — bundles the list-shaped `Collaborator`
 * (for the header) and the `CollaboratorDetailData` (for the score cards,
 * chart, and timeline) so the detail page can feed `CollaboratorDetailView`
 * from a single hook call. Matches what `/api/collaborators/[codDriver]`
 * returns.
 */
export interface CollaboratorDetailDto {
  collaborator: Collaborator;
  detailData: CollaboratorDetailData;
}
