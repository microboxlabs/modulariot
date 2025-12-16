import { ConditionsAgg } from "@/features/symptoms/types/timeline";

export type HistoricSignal = {
  asset_id: string;
  heading: number;
  location: string;
  speed: number;
  timestamp: string;
};

export type HistoricTrip = {
  id: number;
  trip_id: string | null;
  route: string | null;
  departure: string | null;
  arrival: string | null;
  from?: [number, number];
  to?: [number, number];
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

export type ResumedTimeline = {
  trip_id?: string;

  trip_start?: string;
  trip_end?: string;

  trip_origin?: string;
  trip_origin_coordinates?: string;

  trip_destination?: string;
  trip_destination_coordinates?: string;

  timeline_elements: HistoricTimeline[];
};

export type RouteState = {
  selectedRoute: { from: string | undefined; to: string | undefined } | null;
  setSelectedRoute: (
    route: { from: string | undefined; to: string | undefined } | null
  ) => void;
};
