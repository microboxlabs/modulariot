import { ConditionsAgg } from "@/features/symptoms/types/timeline";

export type TreatmentsGeneralResponse = {
  data: TreatmentsGeneralResponseItem;
  status: number;
  message: string;
};

export type TreatmentsGeneralResponseItem = {
  conditions_agg: ConditionsAgg[];
  timeline: TreatmentsTimelineResponse[];
  trip_info: TreatmentsTripInfoResponse;
  symptom_info: TreatmentsSymptomInfoResponse;
};

export type TreatmentsTimelineResponse = {
  assigned_to: string;
  start: string;
  end: string;
  icu_code: string | null;
  is_symptom: number | null;
  symptom_id: number | null;
  icu_condition: string | null;
  count: number;
  symptom_description: string;
  treatments: any[];
  type: string;
};

export type TreatmentsTripInfoResponse = {
  asset_id: string;
  carrier: string;
  destination: string;
  driver: string;
  driver2?: string;
  trip_id: string;
  origin: string;
  type_load: string;
  driver_contact: string;
};

export type TreatmentsSymptomInfoResponse = {
  id: number;
  name: string;
  type: string;
  icu_code: number;
  icu_condition: string;
};
