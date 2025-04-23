export type TreatmentsLocationResponse = {
  data: TreatmentsLocationResponseItem;
  status: number;
  message: string;
};

export type DescriptionProps = {
  speed?: number;
  speed_limit?: number;
  accumulated_drive_time?: string;
  accumulated_detention_time?: string;
  accumulated_time?: string;
  accumulated_resting_time?: string;
  signal_lag?: string;
  median_report_interval?: string;
  last_reported_engine_status?: boolean;
  last_reported_speed?: number;
  symptom_name?: string;
  first_signal_timestamp?: string;
  last_signal_timestamp?: string;
  zone_names?: string;
};

export type TreatmentsLocationResponseItem = {
  type: string;
  features: TreatmentsLocationResponseItemFeature[];
  description: DescriptionProps;
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
