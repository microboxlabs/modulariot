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
}

export interface SymptomsTable {
  icu_code: string;
  id: number;
  client: string;
  driver: string;
  trip_id: string;
  asset_id: string;
  end_time: string;
  start_time: string;
  duration_sec: number;
  symptom_name: string;
  icu_condition: string;
  treatment_count: number;
  type_of_incidence: string;
  geographical_reference_point: string;
  last_assigned_to: string;
}
