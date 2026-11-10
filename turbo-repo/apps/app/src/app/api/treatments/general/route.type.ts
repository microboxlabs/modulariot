import {
  ConditionsAgg,
  TimelineElement,
} from "@/features/symptoms/types/timeline";
import type { LevelResponseView } from "@/features/symptoms/maintainer/maintainer-api";
import type { LevelReason } from "@/features/symptoms/model/level-reason";
import type { IgnoredInfo } from "@/features/symptoms/model/ignore-hold";
import type { MapWindow } from "@/features/symptoms/model/case-window";

export type TreatmentsGeneralResponse = {
  data: TreatmentsGeneralResponseItem;
  status: number;
  message: string;
};

export type TreatmentsGeneralResponseItem = {
  conditions_agg: ConditionsAgg[];
  timeline?: TimelineElement[];
  trip_info: TreatmentsTripInfoResponse;
  symptom_info: TreatmentsSymptomInfoResponse;
  /** Engine cases only: why the case is at its level. */
  level_reason?: LevelReason | null;
  /** Engine cases only: the range of the map's positions and the case's own time. */
  map_window?: MapWindow | null;
  /** Engine cases: response from the case definition and deciding level version. */
  level_response?: LevelResponseView | null;
};

export type TreatmentsTripInfoResponse = {
  asset_id: string;
  /** The plate the trip runs on now; differs from asset_id after a truck change. */
  trip_asset_id?: string | null;
  carrier: string;
  destination: string;
  driver: string;
  driver2?: string;
  trip_id: string;
  trip_code?: string | null;
  origin: string;
  type_load: string;
  driver_contact: string;
};

export type TreatmentsSymptomInfoResponse = {
  id: number;
  name: string;
  type: string;
  icu_code: number;
  icu_condition: string;
  /** Engine cases only: when the case opened, and when its condition began. */
  opened_at?: string;
  /** The server's current-level SLA start, including returns from holds. */
  sla_since?: string | null;
  /** Engine cases: resolved SLA; null means this case requires no operator. */
  sla_minutes?: number | null;
  started_at?: string;
  duration_sec?: number;
  /** Engine cases on an "Ignorar condición" hold. */
  ignored?: IgnoredInfo | null;
  /** When the case came back to the tower from its latest hold. */
  returned_after_ignore_at?: string | null;
};
