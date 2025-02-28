export type TreatmentsGeneralResponse = {
  data: TreatmentsGeneralResponseItem;
  status: number;
  message: string;
};

export type TreatmentsGeneralResponseItem = {  
  timeline: TreatmentsTimelineResponse[],
  trip_info: TreatmentsTripInfoResponse,
  symptom_info: TreatmentsSymptomInfoResponse
};

export type TreatmentsTimelineResponse = {
  event_time: string;
  event_type: string;
  description: string;
};

export type TreatmentsTripInfoResponse = {
  client: string;
  driver: string;
  trip_id: string;
};

export type TreatmentsSymptomInfoResponse = {
  id: number;
  name: string;
  type: string;
};

