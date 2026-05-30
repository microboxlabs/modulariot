export interface ObservationTypeItem {
  nodeRef: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  position?: number | null;
  /** Document-category codes (mintral:contentType) this reason is offered for; empty = all. */
  appliesTo?: string[] | null;
}
