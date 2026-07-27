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
  /**
   * Where this came from, which decides whether it can be edited at all.
   *
   * A `round` observation is not a note attached to a decision — it *is* the decision, its
   * reasons and its comment as the repository recorded them. There is no endpoint to delete
   * one, and no meaning in doing so: the history would then disagree with the verdict it
   * explains.
   *
   * Stated rather than inferred from the id. The delete path used to read `obs-` as "draft"
   * and everything else as "a forum topic", which was true only while those were the only two
   * sources. Rounds became a third, so `round-1-detail` was posted to the forum as a nodeRef
   * — `topic/delete workspace://SpacesStore/round-1-detail`, a 500 — while the card had
   * already been stripped locally, leaving the panel and the repository disagreeing.
   *
   * Undefined means a draft the reviewer is still staging, which is removable and has never
   * been sent anywhere.
   */
  source?: "forum" | "round";
};

export type StateChangeTimelineEntry = {
  kind: "state_change";
  id: string;
  status: "approved" | "rejected" | "pending";
  committedAt: Date;
  committedBy?: string;
  observations: ObservationEntry[];
  /**
   * The `cm:versionLabel` this decision judged.
   *
   * A verdict is about the bytes that were on screen when it was given, not about the node.
   * Re-uploading a rejected photo makes a new version and puts it back in the queue, and the
   * old rejection then explains content nobody can see any more — shown as the current state,
   * it reads as "we already rejected this" about a photo that has not been looked at.
   *
   * `null` is a decision on a node the repository was not versioning yet, which the first
   * re-upload turns into v1.1 — so it is a real value, distinct from the current version.
   *
   * `undefined` means the entry cannot say: every forum-era post, which recorded no version.
   * Those are shown with the current revision rather than filed under one they never named,
   * and they never override the stored `mintral:reviewStatus`.
   */
  version?: string | null;
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
