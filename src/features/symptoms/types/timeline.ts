export interface TimelineElement {
  conditions_agg?: ConditionsAgg[];
  start: string;
  end: string;
  icu_codes?: number[];
  icu_conditions?: string[];
  symptom_id?: number;
  symptom_name?: string;
}

export interface ConditionsAgg {
  assigned_to: string;
  start: string;
  end: string;
  icu_code: string | null;
  is_symptom: number | null;
  symptom_id: number | null;
  icu_condition: string | null;
  count: number;
  symptom_description: string;
  treatments: TreatmentTimelineElement[];
  type: string;
  evidences: string[] | null;
}

export interface TreatmentTimelineElement {
  treatment_type: string;
  description: DescriptionTimelineElement;
}

export interface DescriptionTimelineElement {
  driver_response: string;
  message: string;
}

export interface TimelineItem {
  start: string;
  end: string;
  icu_condition: string;
  description: string;
  type: string;
  assigned_to: string;
  icu_code: string | null;
  is_symptom: number | null;
  symptom_id: number | null;
  evidences: string[] | null;
}
