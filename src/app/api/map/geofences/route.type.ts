export interface SymptomsICUResponse {
  data: SymptomsICUItemResponse[];
  status: number;
  message: string;
}

export interface SymptomsICUItemResponse {
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
}
