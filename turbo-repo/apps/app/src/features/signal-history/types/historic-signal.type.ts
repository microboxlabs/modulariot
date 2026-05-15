import { ConditionsAgg } from "@/features/symptoms/types/timeline";

export type HistoricSignal = {
  assetid: string;
  heading: number;
  location: string;
  speed: number;
  timestamp: string;
  tripid: string;
  distance: number;
  latitude: number;
  longitude: number;
};

export type HistoricTimeline = {
  // conditions_agg: [{…}]
  conditions_agg: ConditionsAgg[];
  end?: string;
  event_type?: string;
  icu_codes: number[];
  icu_conditions: string[];
  id: string;
  name: string;
  start?: string;
  trip_destination?: string;
  trip_destination_coordinates?: string;
  trip_end?: string;
  trip_id?: string;
  trip_origin?: string;
  trip_origin_coordinates?: string;
  trip_start?: string;
};

