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
  /** Engine cases: when and by whom. */
  at?: string | null;
  by?: string | null;
  /** An "ignorar condicion" row: until when the case is on hold; null until the trip ends. */
  ignored_until?: string | null;
  until_trip_end?: boolean;
  scope?: string | null;
  /** A "fin de ignorar" row: how the hold ended. */
  resolution?: string | null;
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
