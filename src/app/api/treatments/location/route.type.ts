export type TreatmentsLocationResponse = {
  data: TreatmentsLocationResponseItem;
  status: number;
  message: string;
};

export type TreatmentsLocationResponseItem = {
  type: string;
  features: TreatmentsLocationResponseItemFeature[];
};

export type TreatmentsLocationResponseItemFeature = {
  type: string;
  geometry: string;
  longitude: number | null;
  latitude: number | null;
  properties: TreatmentsLocationResponseItemFeatureProperties;
  status: string;
};

export type TreatmentsLocationResponseItemFeatureProperties = {
  speed: number;
  timestamp: string;
};
