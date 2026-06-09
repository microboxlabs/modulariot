// The active list of reasons is served at runtime by the Alfresco "Tipos de
// Observación" data list (ecm-coordinator, prefix `observationtypedl`). This
// union + OBSERVATION_TYPE_KEYS is the persisted code type and the offline
// fallback rendered before that catalog loads — keep the codes here in sync
// with the data list seed (tools/js-console/utility/sync-observation-types.js).
export type ObservationType =
  | "value_not_visible"
  | "bad_lighting"
  | "poor_image_quality"
  | "wrong_document"
  | "incorrect_data"
  | "document_incomplete"
  | "document_expired"
  | "missing_signature"
  | "illegible_text"
  | "document_damaged"
  | "wrong_format"
  | "other";

export const OBSERVATION_TYPE_KEYS: ObservationType[] = [
  "value_not_visible",
  "bad_lighting",
  "poor_image_quality",
  "wrong_document",
  "incorrect_data",
  "document_incomplete",
  "document_expired",
  "missing_signature",
  "illegible_text",
  "document_damaged",
  "wrong_format",
  "other",
];

export type ReplyEntry = {
  id: string;
  description: string;
  createdAt: Date;
  createdBy?: string;
};

export type ObservationEntry = {
  id: string;
  types: ObservationType[];
  description: string;
  createdAt: Date;
  createdBy?: string;
  replies?: ReplyEntry[];
};

export type StateChangeTimelineEntry = {
  kind: "state_change";
  id: string;
  status: "approved" | "rejected" | "pending";
  committedAt: Date;
  committedBy?: string;
  observations: ObservationEntry[];
};

export type LooseObservationTimelineEntry = {
  kind: "observation";
  id: string;
  types: ObservationType[];
  description: string;
  createdAt: Date;
  createdBy?: string;
  replies?: ReplyEntry[];
};

export type TimelineEntry = StateChangeTimelineEntry | LooseObservationTimelineEntry;
