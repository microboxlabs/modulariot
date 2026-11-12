import type { IgnoredInfo } from "@/features/symptoms/model/ignore-hold";
import type {
  CaseTreatment,
  TreatmentState,
} from "@/features/symptoms/model/treatment-state";

export interface SymptomsICUResponse {
  data: SymptomsICUItemResponse[];
  status: number;
  message: string;
}

export interface SymptomsICUItemResponse {
  ignored?: IgnoredInfo | null;
  id: number;
  client: string;
  driver: string;
  trip_id: string;
  /** The client's service code; null when the trip has none. */
  trip_code?: string | null;
  asset_id: string;
  end_time: string;
  start_time: string;
  duration_sec: number;
  symptom_name: string;
  icu_condition: string;
  icu_code: string;
  treatment_count: number;
  type_of_incidence: string;
  geographical_reference_point: string;
  /** What the operators did about the case, and the treatment behind it. */
  treatment_state?: TreatmentState | null;
  treatment?: CaseTreatment | null;
}
