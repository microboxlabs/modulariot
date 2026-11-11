import { TableItemType } from "../components/table-item.type";
import type { TreatmentState } from "../model/treatment-state";

export interface SymptomDashboard {
  codeBlack: number;
  critic: number;
  treatment: number;
  observation: number;
  stable: number;
  compromised: number;
  remission: number;
  /** Engine cases on an "Ignorar condición" hold. */
  ignored?: number;
}

/** The conditions the symptoms constellation shows, one orbiting icon each. */
export type ConstellationCondition =
  | "codeBlack"
  | "critic"
  | "compromised"
  | "observation"
  | "treatment"
  | "stable";

/** Open cases by condition and vehicles on a trip, for the list's filters. */
export interface SymptomConstellationCounts {
  conditions: Record<ConstellationCondition, number>;
  vehiclesOnTrip: number;
  /** Held cases for the counter card; they have no constellation icon. */
  ignored: number;
  /** The same cases by treatment state, whatever treatment state is filtered. */
  treatmentStates?: Record<TreatmentState, number>;
}

/* export interface SymptomTableItem {
  id: number;
  condition: string;
  licensePlate: string;
  time: string;
  trip: string;
  driver: string;
  date: string;
  service: string;
  alertType: string;
  status: string;
} */

export interface SymptomTableResponse {
  data: TableItemType[];
  pagination: SymptomTablePagination;
  symptoms_list: string[];
}

export interface SymptomTablePagination {
  total_rows: number;
  total_pages: number;
  currentPage: number;
  page_size: number;
}
