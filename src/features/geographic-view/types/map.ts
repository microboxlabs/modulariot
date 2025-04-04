import React from "react";

export interface Symptom {
  created_at: string;
  description: string | null;
  icu_code: number;
  symptom_id: number;
  symptom_name: string;
  symptom_type: string;
}

export interface MapPosition {
  longitude: number;
  latitude: number;
  /* rotation: number;
   state: string;
   licensePlate?: string;
   driver?: string;
   trip?: string; */
  assetid: string;
  carrier_name: string;
  driver_name: string;
  engine_status: string;
  estimated_arrival_time: string | null;
  heading: number;
  is_moving: boolean;
  location: string;
  request_id: string;
  route: string;
  speed: number;
  symptoms_condition: number;
  start_time: string;
  timestamp: string;
  trip_id: string;
  symptoms: Symptom[];
  associate_symptoms: Symptom[];

  type: string;
  owner: string | null;
  year: string | null;
  altitude: number;
  sensors: MapSensor;
  peripherals: null;
  events: null;
  status: string;
  telcom_iccid: string | null;
  telcom_imsi: string | null;
  telcom_operator: string;
  telcom_mcc: string | null;
  telcom_mnc: string | null;
  telcom_cell_id: string | null;
  telcom_lac: string | null;
  telcom_signal_strength: string | null;
  telcom_gps_provider: string;
  driver_id: string | null;
  driver_license_number: string | null;
  driver_contact_phone: string | null;
  driver_contact_email: string | null;
  co_driver_id: string | null;
  co_driver_name: string | null;
  co_driver_license_number: string | null;
  co_driver_contact_phone: string | null;
  co_driver_contact_email: string | null;
  client_id: string;
  data_validation_status: string | null;
  signal_quality_status: string | null;
  movement_status: string | null;
  symptom_condition: string | null;
  speed_limit_condition: string | null;
}

export interface MapPositionProperties {
  properties: {
    lost_signal: React.JSX.Element;
    associate_symptoms: any;
    symptoms_condition: boolean;
    longitude: number;
    latitude: number;
    /* rotation: number;
    state: string;
    licensePlate?: string;
    driver?: string;
    trip?: string; */
    speed_limit: number;
    id: string;
    type: string;
    owner: string | null;
    year: string | null;
    timestamp: string;
    location: string;
    altitude: number;
    speed: number;
    heading: number;
    sensors: MapSensor;
    peripherals: null;
    events: null;
    status: string;
    asset_id: string;
    assetid: string; //alias for asset_id TODO: remove unused field
    telcom_iccid: string | null;
    telcom_imsi: string | null;
    telcom_operator: string;
    telcom_mcc: string | null;
    telcom_mnc: string | null;
    telcom_cell_id: string | null;
    telcom_lac: string | null;
    telcom_signal_strength: string | null;
    telcom_gps_provider: string;
    driver_id: string | null;
    driver_name: string | null;
    driver_license_number: string | null;
    driver_contact_phone: string | null;
    driver_contact_email: string | null;
    co_driver_id: string | null;
    co_driver_name: string | null;
    co_driver_license_number: string | null;
    co_driver_contact_phone: string | null;
    co_driver_contact_email: string | null;
    trip_id: string;
    client_id: string;
    data_validation_status: string | null;
    signal_quality_status: string | null;
    movement_status: string | null;
    cluster: boolean;
  };
}

export interface MapResponse {
  data: MapPosition[];
}

export interface MapSensor {
  odometer: number | null;
  gyroscope: number | null;
  asset_load: number | null;
  acceleration: MapSensorAcceleration;
  engine_status: boolean;
}

export interface MapSensorAcceleration {
  x_axis: number;
  y_axis: number;
  z_axis: number;
  g_force: number | null;
}

export interface MapPositionResume {
  sections: MapSection[];
}

export interface MapSection {
  title: string;
  icon: React.ReactNode;
  items: MapItem[];
}

export interface MapItem {
  key: string;
  value: number;
}
