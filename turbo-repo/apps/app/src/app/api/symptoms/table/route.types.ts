import type { IgnoredInfo } from "@/features/symptoms/model/ignore-hold";

export interface SymptomsTableRequest {
  page: number;
  limit: number;
  service: string;
  condition: string;
}

export interface SymptomsTableResponse {
  data: SymptomsTable[];
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  status: number;
  message: string;
  symptom_name_list: string[];
}

export interface SymptomsTable {
  icu_code: string;
  id: number;
  client: string;
  driver: string;
  trip_id: string;
  trip_code?: string | null;
  asset_id: string;
  /** The plate the case's trip runs on now; differs from asset_id after a truck change. */
  trip_asset_id?: string | null;
  end_time: string;
  start_time: string;
  /** Seconds for the evaluator's cases, a Postgres interval for the GPS database's. */
  duration_sec: number | string;
  symptom_name: string;
  icu_condition: string;
  treatment_count: number;
  type_of_incidence: string;
  geographical_reference_point: string;
  last_assigned_to: string;
  sla_minutes: number | null;
  recurrence_events: number | null;
  /** Engine cases on an "Ignorar condición" hold. */
  ignored?: IgnoredInfo | null;
  /** When the case came back to the tower from its latest hold. */
  returned_after_ignore_at?: string | null;
  /** When the SLA of the case's current level started. */
  sla_since?: string | null;
  /** Whether the case's current level goes to the operators; absent on GPS database symptoms. */
  operator_required?: boolean | null;
}
