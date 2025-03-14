export type TreatmentsGeneralResponse = {
  data: TreatmentsGeneralResponseItem;
  status: number;
  message: string;
};

export type TreatmentsGeneralResponseItem = {
  timeline: TreatmentsTimelineResponse[];
  trip_info: TreatmentsTripInfoResponse;
  symptom_info: TreatmentsSymptomInfoResponse;
};

export type TreatmentsTimelineResponse = {
  end: string;
  start: string;
  type: string;
  description: string;
  icu_condition: string;
};

export type TreatmentsTripInfoResponse = {
  asset_id: string;
  carrier: string;
  destination: string;
  driver: string;
  trip_id: string;
  origin: string;
};

export type TreatmentsSymptomInfoResponse = {
  id: number;
  name: string;
  type: string;
  icu_code: number;
  icu_condition: string;
};
