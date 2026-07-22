/**
 * Client-facing shape of a knowledge candidate from the semantic-layer learning
 * loop's staging store. Declared here (not imported from the server-only
 * `candidates-client`) so client components stay free of server imports.
 */
export interface KnowledgeCandidate {
  id: string;
  connection: string;
  term: string;
  kind: string | null;
  scope: string;
  confidence: number | null;
  body: string;
  status: string;
  createdBy: string | null;
  reviewedBy: string | null;
}

/** Response of the review route: the transitioned candidate + apply status. */
export interface ReviewResult {
  candidate: KnowledgeCandidate;
  cardApplied?: boolean;
  error?: string;
}
