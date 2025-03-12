export type TreatmentsRequest = {
  asset_id: string;
  assigned_to: string;
  client_id: string | null;
  status: string;
  symptom_id: string | null;
  treatment_type: string;
  trip_id: string;

  message: string | null | undefined;
  driver_response: string | null | undefined;
  description: string | null | undefined;

  treatment_id: number | null | undefined;
};

export type TreatmentsResponse = {
  data: TreatmentsRequest;
  status: number;
  message: string;
};
